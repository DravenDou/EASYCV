import asyncio
import io
import json
import logging
import os
import time
import uuid
from collections.abc import AsyncGenerator, Callable
from contextvars import ContextVar
from typing import Any

from cachetools import TTLCache
from fastapi import FastAPI, HTTPException, Request, Response, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address
from starlette.middleware.base import BaseHTTPMiddleware

from rendercv import __version__
from rendercv.exception import RenderCVUserError, RenderCVUserValidationError
from rendercv.schema.models.base import BaseModelWithoutExtraKeys

from .models import (
    ErrorResponse,
    HealthResponse,
    PhotoUploadResponse,
    RenderRequest,
    RenderResponse,
    ValidateRequest,
    ValidateResponse,
)
from .service import convert_validation_errors, render_web_request, validate_web_request

logger = logging.getLogger("rendercv.web.api")

request_id_var: ContextVar[str] = ContextVar("request_id", default="-")

# In-memory TTL cache for temporary photo tokens (30-minute expiry, max 500 entries).
# Keys are random tokens; values are the stored image bytes.
photo_token_cache: TTLCache[str, bytes] = TTLCache(maxsize=500, ttl=1800)

# Accepted MIME types for photo upload.
ALLOWED_PHOTO_MIME_TYPES: frozenset[str] = frozenset(
    {"image/jpeg", "image/png", "image/webp"}
)
MAX_PHOTO_BYTES: int = 2 * 1024 * 1024  # 2 MB


type MiddlewareFactory = Callable[..., CORSMiddleware]


class WebApiSettings(BaseModelWithoutExtraKeys):
    """Settings for web API runtime behavior."""

    cors_origins: list[str]
    max_yaml_bytes: int
    max_artifact_bytes: int
    validate_timeout_seconds: int
    render_timeout_seconds: int


def parse_cors_origins(origins_text: str | None) -> list[str]:
    """Parse comma-separated origins from environment.

    Args:
        origins_text: Comma-separated origins.

    Returns:
        List of origins or wildcard default.
    """
    if origins_text is None or origins_text.strip() == "":
        return ["*"]

    origins = [origin.strip() for origin in origins_text.split(",") if origin.strip()]
    return origins if origins else ["*"]


def parse_int_setting(value: str | None, default_value: int) -> int:
    """Parse integer environment setting with fallback default."""
    if value is None:
        return default_value

    try:
        return int(value)
    except ValueError:
        return default_value


def load_web_api_settings() -> WebApiSettings:
    """Load API settings from environment variables.

    Why:
        Environment-based configuration is deployment-friendly for cloud
        platforms and lets operators tune limits without code changes.

    Returns:
        Parsed and validated WebApiSettings.
    """
    return WebApiSettings(
        cors_origins=parse_cors_origins(os.getenv("RENDERCV_WEB_CORS_ORIGINS")),
        max_yaml_bytes=parse_int_setting(
            os.getenv("RENDERCV_WEB_MAX_YAML_BYTES"), 500_000
        ),
        max_artifact_bytes=parse_int_setting(
            os.getenv("RENDERCV_WEB_MAX_ARTIFACT_BYTES"), 12_000_000
        ),
        validate_timeout_seconds=parse_int_setting(
            os.getenv("RENDERCV_WEB_VALIDATE_TIMEOUT_SECONDS"), 12
        ),
        render_timeout_seconds=parse_int_setting(
            os.getenv("RENDERCV_WEB_RENDER_TIMEOUT_SECONDS"), 60
        ),
    )


def build_http_exception(status_code: int, error: ErrorResponse) -> HTTPException:
    """Build a FastAPI HTTPException from structured API error payload."""
    return HTTPException(status_code=status_code, detail=error.model_dump())


class RequestIdLoggingMiddleware(BaseHTTPMiddleware):
    """Attach a unique request_id to every request and inject it into log records.

    Why:
        Correlating log lines per request is essential for production debugging.
        The request_id is stored in a ContextVar so that all log calls made
        inside a single request share the same identifier automatically.
    """

    async def dispatch(self, request: Request, call_next: Any) -> Response:
        rid = request.headers.get("X-Request-Id") or str(uuid.uuid4())
        token = request_id_var.set(rid)
        response: Response = await call_next(request)
        response.headers["X-Request-Id"] = rid
        request_id_var.reset(token)
        return response


def create_app(settings: WebApiSettings | None = None) -> FastAPI:
    """Create and configure the RenderCV FastAPI application.

    Why:
        A factory function makes the app instantiable in tests without relying
        on module-level globals. Tests can call ``create_app()`` with custom
        settings; production uses the module-level ``app`` singleton.

    Args:
        settings: Optional pre-built settings; loads from environment if None.

    Returns:
        Configured FastAPI application instance.
    """
    resolved_settings = settings or load_web_api_settings()

    limiter = Limiter(key_func=get_remote_address)

    application = FastAPI(
        title="RenderCV Web API",
        version=__version__,
        description=(
            "API-first backend for validating and rendering RenderCV YAML payloads."
        ),
    )
    application.state.limiter = limiter
    application.state.web_api_settings = resolved_settings
    application.add_exception_handler(  # ty: ignore[arg-type]
        RateLimitExceeded, _rate_limit_exceeded_handler
    )
    application.add_middleware(RequestIdLoggingMiddleware)  # ty: ignore[arg-type]
    application.add_middleware(
        CORSMiddleware,  # ty: ignore[invalid-argument-type]
        allow_origins=resolved_settings.cors_origins,
        allow_credentials=False,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    limiter_validate = Limiter(key_func=get_remote_address)
    limiter_render = Limiter(key_func=get_remote_address)

    @application.get("/health", response_model=HealthResponse, tags=["system"])
    def health_check() -> HealthResponse:
        """Return service health and version."""
        return HealthResponse(status="ok", version=__version__)

    @application.post("/api/v1/validate", response_model=ValidateResponse, tags=["render"])
    @limiter_validate.limit("30/minute")
    async def validate_yaml(request: Request, body: ValidateRequest) -> ValidateResponse:  # noqa: ARG001
        """Validate RenderCV payload and return structured issues if invalid."""
        request_id = request_id_var.get()

        try:
            await asyncio.wait_for(
                asyncio.to_thread(
                    validate_web_request,
                    body,
                    resolved_settings.max_yaml_bytes,
                ),
                timeout=resolved_settings.validate_timeout_seconds,
            )
            return ValidateResponse(request_id=request_id, valid=True, errors=[])
        except RenderCVUserValidationError as error:
            validation_errors = convert_validation_errors(error.validation_errors)
            return ValidateResponse(
                request_id=request_id,
                valid=False,
                errors=validation_errors,
            )
        except RenderCVUserError as error:
            message = error.message or "Request could not be processed."
            status_code = 413 if "too large" in message else 400
            error_code = "payload_too_large" if status_code == 413 else "user_error"
            raise build_http_exception(
                status_code,
                ErrorResponse(
                    request_id=request_id,
                    error_code=error_code,
                    message=message,
                ),
            ) from error
        except TimeoutError as error:
            raise build_http_exception(
                408,
                ErrorResponse(
                    request_id=request_id,
                    error_code="timeout",
                    message=(
                        "Validation request timed out. Try a smaller payload or retry."
                    ),
                ),
            ) from error
        except Exception as error:
            logger.exception("Unhandled error while validating request %s", request_id)
            raise build_http_exception(
                500,
                ErrorResponse(
                    request_id=request_id,
                    error_code="internal_error",
                    message="An unexpected internal error occurred.",
                ),
            ) from error

    @application.post("/api/v1/render", response_model=RenderResponse, tags=["render"])
    @limiter_render.limit("10/minute")
    async def render_yaml(request: Request, body: RenderRequest) -> RenderResponse:  # noqa: ARG001
        """Render selected artifacts from RenderCV payload."""
        request_id = request_id_var.get()

        try:
            artifacts = await asyncio.wait_for(
                asyncio.to_thread(
                    render_web_request,
                    body,
                    resolved_settings.max_yaml_bytes,
                    resolved_settings.max_artifact_bytes,
                ),
                timeout=resolved_settings.render_timeout_seconds,
            )
            return RenderResponse(request_id=request_id, artifacts=artifacts)
        except RenderCVUserValidationError as error:
            validation_errors = convert_validation_errors(error.validation_errors)
            raise build_http_exception(
                422,
                ErrorResponse(
                    request_id=request_id,
                    error_code="validation_error",
                    message="Input validation failed.",
                    validation_errors=validation_errors,
                ),
            ) from error
        except RenderCVUserError as error:
            message = error.message or "Request could not be processed."
            status_code = 413 if "too large" in message else 400
            error_code = "payload_too_large" if status_code == 413 else "user_error"
            raise build_http_exception(
                status_code,
                ErrorResponse(
                    request_id=request_id,
                    error_code=error_code,
                    message=message,
                ),
            ) from error
        except TimeoutError as error:
            raise build_http_exception(
                408,
                ErrorResponse(
                    request_id=request_id,
                    error_code="timeout",
                    message="Render request timed out.",
                ),
            ) from error
        except Exception as error:
            logger.exception("Unhandled error while rendering request %s", request_id)
            raise build_http_exception(
                500,
                ErrorResponse(
                    request_id=request_id,
                    error_code="internal_error",
                    message="An unexpected internal error occurred.",
                ),
            ) from error

    @application.post("/api/v1/upload-photo", response_model=PhotoUploadResponse, tags=["media"])
    async def upload_photo(request: Request, file: UploadFile) -> PhotoUploadResponse:
        """Accept a profile photo, validate it, and return a short-lived token URL.

        Why:
            cv.photo is blocked on the public API to prevent path traversal.
            This endpoint allows photo uploads through a controlled channel:
            strict MIME, size, and dimension checks gate the upload, and the
            resulting token is stored in a TTLCache (30 min) for use as a
            safe, validated photo reference in subsequent render requests.

        Returns:
            PhotoUploadResponse with a token URL and expiry timestamp.
        """
        request_id = request_id_var.get()

        content_type = file.content_type or ""
        if content_type not in ALLOWED_PHOTO_MIME_TYPES:
            raise build_http_exception(
                415,
                ErrorResponse(
                    request_id=request_id,
                    error_code="user_error",
                    message=(
                        f"Unsupported media type '{content_type}'. "
                        "Allowed: image/jpeg, image/png, image/webp."
                    ),
                ),
            )

        image_bytes = await file.read(MAX_PHOTO_BYTES + 1)
        if len(image_bytes) > MAX_PHOTO_BYTES:
            raise build_http_exception(
                413,
                ErrorResponse(
                    request_id=request_id,
                    error_code="payload_too_large",
                    message="Photo exceeds the 2 MB size limit.",
                ),
            )

        try:
            from PIL import Image as PilImage  # noqa: PLC0415 — lazy import

            img = PilImage.open(io.BytesIO(image_bytes))
            width, height = img.size
            if not (100 <= width <= 2000 and 100 <= height <= 2000):
                raise build_http_exception(
                    422,
                    ErrorResponse(
                        request_id=request_id,
                        error_code="user_error",
                        message=(
                            f"Image dimensions {width}×{height} are outside the "
                            "allowed range (100–2000 px per side)."
                        ),
                    ),
                )
        except ImportError:
            # Pillow is optional — skip dimension check when unavailable.
            logger.warning("Pillow not installed; skipping photo dimension validation.")

        token = str(uuid.uuid4())
        photo_token_cache[token] = image_bytes
        expires_at = int(time.time()) + 1800

        return PhotoUploadResponse(
            request_id=request_id,
            token=token,
            photo_url=f"/api/v1/photo/{token}",
            expires_at=expires_at,
        )

    @application.get("/api/v1/photo/{token}", tags=["media"])
    async def serve_photo(token: str) -> Response:
        """Serve a previously uploaded photo by its token."""
        image_bytes = photo_token_cache.get(token)
        if image_bytes is None:
            raise HTTPException(status_code=404, detail="Photo token not found or expired.")
        return Response(content=image_bytes, media_type="image/jpeg")

    @application.post("/api/v1/render-stream", tags=["render"])
    @limiter_render.limit("10/minute")
    async def render_yaml_stream(request: Request, body: RenderRequest) -> StreamingResponse:  # noqa: ARG001
        """Render with per-stage Server-Sent Events progress stream.

        Why:
            Large CVs take several seconds to compile. SSE lets the frontend
            display meaningful progress (validating → templating → compiling →
            done) instead of a frozen spinner.

        Returns:
            text/event-stream response emitting JSON progress events.
        """
        request_id = request_id_var.get()

        async def event_stream() -> AsyncGenerator[str, None]:
            def send_event(stage: str, progress: float, message: str = "") -> str:
                payload = json.dumps(
                    {"stage": stage, "progress": progress, "message": message, "request_id": request_id}
                )
                return f"data: {payload}\n\n"

            try:
                yield send_event("validating", 0.1, "Validando YAML...")

                await asyncio.sleep(0)  # yield control

                yield send_event("building_model", 0.3, "Construyendo modelo...")

                artifacts = await asyncio.wait_for(
                    asyncio.to_thread(
                        render_web_request,
                        body,
                        resolved_settings.max_yaml_bytes,
                        resolved_settings.max_artifact_bytes,
                    ),
                    timeout=resolved_settings.render_timeout_seconds,
                )

                yield send_event("compiling", 0.75, "Compilando PDF...")
                await asyncio.sleep(0)

                result = RenderResponse(request_id=request_id, artifacts=artifacts)
                done_payload = json.dumps(
                    {
                        "stage": "done",
                        "progress": 1.0,
                        "request_id": request_id,
                        "artifacts": [a.model_dump() for a in result.artifacts],
                    }
                )
                yield f"data: {done_payload}\n\n"

            except RenderCVUserValidationError as error:
                errs = convert_validation_errors(error.validation_errors)
                err_payload = json.dumps(
                    {"stage": "error", "progress": 0.0, "error_code": "validation_error",
                     "validation_errors": [e.model_dump() for e in errs]}
                )
                yield f"data: {err_payload}\n\n"
            except TimeoutError:
                yield send_event("error", 0.0, "Render timed out.")
            except Exception:
                logger.exception("SSE stream error for request %s", request_id)
                yield send_event("error", 0.0, "Internal server error.")

        return StreamingResponse(
            event_stream(),
            media_type="text/event-stream",
            headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
        )

    return application


web_api_settings = load_web_api_settings()
app = create_app(web_api_settings)



