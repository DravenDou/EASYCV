import asyncio
import logging
import os
import uuid

from collections.abc import Callable

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from rendercv import __version__
from rendercv.exception import RenderCVUserError, RenderCVUserValidationError
from rendercv.schema.models.base import BaseModelWithoutExtraKeys

from .models import (
    ErrorResponse,
    HealthResponse,
    RenderRequest,
    RenderResponse,
    ValidateRequest,
    ValidateResponse,
)
from .service import convert_validation_errors, render_web_request, validate_web_request

logger = logging.getLogger("rendercv.web.api")


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


web_api_settings = load_web_api_settings()

app = FastAPI(
    title="RenderCV Web API",
    version=__version__,
    description=(
        "API-first backend for validating and rendering RenderCV YAML payloads."
    ),
)

app.add_middleware(
    CORSMiddleware,  # ty: ignore[invalid-argument-type]
    allow_origins=web_api_settings.cors_origins,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health", response_model=HealthResponse, tags=["system"])
def health_check() -> HealthResponse:
    """Return service health and version."""
    return HealthResponse(status="ok", version=__version__)


@app.post("/api/v1/validate", response_model=ValidateResponse, tags=["render"])
async def validate_yaml(request: ValidateRequest) -> ValidateResponse:
    """Validate RenderCV payload and return structured issues if invalid."""
    request_id = str(uuid.uuid4())

    try:
        await asyncio.wait_for(
            asyncio.to_thread(
                validate_web_request,
                request,
                web_api_settings.max_yaml_bytes,
            ),
            timeout=web_api_settings.validate_timeout_seconds,
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


@app.post("/api/v1/render", response_model=RenderResponse, tags=["render"])
async def render_yaml(request: RenderRequest) -> RenderResponse:
    """Render selected artifacts from RenderCV payload."""
    request_id = str(uuid.uuid4())

    try:
        artifacts = await asyncio.wait_for(
            asyncio.to_thread(
                render_web_request,
                request,
                web_api_settings.max_yaml_bytes,
                web_api_settings.max_artifact_bytes,
            ),
            timeout=web_api_settings.render_timeout_seconds,
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
