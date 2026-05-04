from typing import Literal

import pydantic

from rendercv.schema.models.base import BaseModelWithoutExtraKeys


type ArtifactFormat = Literal["pdf", "png", "html", "markdown", "typst"]
type ArtifactEncoding = Literal["base64", "utf-8"]
type ApiErrorCode = Literal[
    "payload_too_large",
    "validation_error",
    "user_error",
    "timeout",
    "internal_error",
]


class ValidationIssue(BaseModelWithoutExtraKeys):
    """Structured validation issue for API responses.

    Why:
        Web clients need consistent field locations to highlight invalid
        YAML/schema fields inline.

    Args:
        schema_location: Dot-path segments in the schema when available.
        yaml_source: Which input YAML stream the issue belongs to.
        start_line: 1-indexed start line in source YAML.
        start_column: 1-indexed start column in source YAML.
        end_line: 1-indexed end line in source YAML.
        end_column: 1-indexed end column in source YAML.
        message: Human-readable validation message.
        input_value: Source value that caused the issue.
    """

    schema_location: list[str] | None
    yaml_source: str
    start_line: int | None
    start_column: int | None
    end_line: int | None
    end_column: int | None
    message: str
    input_value: str


class RenderFormats(BaseModelWithoutExtraKeys):
    """Output selection flags for render requests."""

    include_pdf: bool = pydantic.Field(default=True)
    include_png: bool = pydantic.Field(default=False)
    include_html: bool = pydantic.Field(default=False)
    include_markdown: bool = pydantic.Field(default=False)
    include_typst: bool = pydantic.Field(default=False)


class ValidateRequest(BaseModelWithoutExtraKeys):
    """Input payload for validation endpoint."""

    main_yaml: str = pydantic.Field(min_length=1)
    design_yaml: str | None = pydantic.Field(default=None)
    locale_yaml: str | None = pydantic.Field(default=None)
    settings_yaml: str | None = pydantic.Field(default=None)
    overrides: dict[str, str] | None = pydantic.Field(default=None)


class RenderRequest(ValidateRequest):
    """Input payload for render endpoint."""

    formats: RenderFormats = pydantic.Field(default_factory=RenderFormats)


class ValidateResponse(BaseModelWithoutExtraKeys):
    """Validation result returned to clients."""

    request_id: str
    valid: bool
    errors: list[ValidationIssue] = pydantic.Field(default_factory=list)


class RenderedArtifact(BaseModelWithoutExtraKeys):
    """Single generated artifact returned by the render endpoint."""

    format: ArtifactFormat
    filename: str
    media_type: str
    encoding: ArtifactEncoding
    content: str


class RenderResponse(BaseModelWithoutExtraKeys):
    """Render result containing requested artifacts."""

    request_id: str
    artifacts: list[RenderedArtifact]


class ErrorResponse(BaseModelWithoutExtraKeys):
    """Uniform error payload used by all API errors."""

    request_id: str
    error_code: ApiErrorCode
    message: str
    validation_errors: list[ValidationIssue] | None = pydantic.Field(default=None)


class HealthResponse(BaseModelWithoutExtraKeys):
    """Health-check response payload."""

    status: Literal["ok"]
    version: str


class PhotoUploadResponse(BaseModelWithoutExtraKeys):
    """Response returned after a successful photo upload.

    Why:
        Clients receive a short-lived token URL they can reference in
        subsequent render requests as cv.photo without path traversal risk.

    Args:
        request_id: Echo of the request identifier.
        token: UUID token identifying the stored image.
        photo_url: Server path to retrieve the image.
        expires_at: Unix timestamp when the token expires.
    """

    request_id: str
    token: str
    photo_url: str
    expires_at: int
