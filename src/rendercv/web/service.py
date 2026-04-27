import base64
import pathlib
import tempfile

from rendercv.exception import (
    RenderCVUserError,
    RenderCVValidationError,
)
from rendercv.renderer.html import generate_html
from rendercv.renderer.markdown import generate_markdown
from rendercv.renderer.pdf_png import generate_pdf, generate_png
from rendercv.renderer.typst import generate_typst
from rendercv.schema.models.rendercv_model import RenderCVModel
from rendercv.schema.rendercv_model_builder import build_rendercv_dictionary_and_model

from .models import (
    ArtifactFormat,
    RenderRequest,
    RenderedArtifact,
    ValidateRequest,
    ValidationIssue,
)


def convert_validation_error(error: RenderCVValidationError) -> ValidationIssue:
    """Convert internal validation error to API-safe payload.

    Args:
        error: RenderCV validation error.

    Returns:
        ValidationIssue ready for API response.
    """
    start_line: int | None = None
    start_column: int | None = None
    end_line: int | None = None
    end_column: int | None = None

    if error.yaml_location is not None:
        (start_line, start_column), (end_line, end_column) = error.yaml_location

    schema_location = list(error.schema_location) if error.schema_location else None

    return ValidationIssue(
        schema_location=schema_location,
        yaml_source=error.yaml_source,
        start_line=start_line,
        start_column=start_column,
        end_line=end_line,
        end_column=end_column,
        message=error.message,
        input_value=error.input,
    )


def convert_validation_errors(
    errors: list[RenderCVValidationError],
) -> list[ValidationIssue]:
    """Convert multiple validation errors for API output."""
    return [convert_validation_error(error) for error in errors]


def calculate_yaml_payload_size(request: ValidateRequest) -> int:
    """Return total byte size of YAML fields in request.

    Why:
        Limiting payload size prevents oversized requests from exhausting memory.

    Args:
        request: Validate or render request payload.

    Returns:
        Total UTF-8 byte size of YAML text fields.
    """
    yaml_fields = [
        request.main_yaml,
        request.design_yaml or "",
        request.locale_yaml or "",
        request.settings_yaml or "",
    ]
    return sum(len(value.encode("utf-8")) for value in yaml_fields)


def check_yaml_payload_size(request: ValidateRequest, max_yaml_bytes: int) -> None:
    """Raise user error if YAML payload exceeds configured size limit.

    Args:
        request: Validate or render request payload.
        max_yaml_bytes: Maximum allowed bytes for all YAML fields.

    Raises:
        RenderCVUserError: If payload exceeds size limit.
    """
    payload_size = calculate_yaml_payload_size(request)
    if payload_size > max_yaml_bytes:
        raise RenderCVUserError(
            message=(
                f"YAML payload is too large ({payload_size} bytes). Maximum allowed "
                f"size is {max_yaml_bytes} bytes."
            )
        )


def create_input_file(main_yaml: str, directory: pathlib.Path) -> pathlib.Path:
    """Write main YAML input into temporary file for relative path resolution.

    Why:
        RenderCV resolves relative paths against input file location. Web API
        requests are in-memory strings, so a temporary file path is needed.

    Args:
        main_yaml: Main YAML text.
        directory: Temporary working directory.

    Returns:
        Path to temporary input YAML file.
    """
    input_file_path = directory / "input.yaml"
    input_file_path.write_text(main_yaml, encoding="utf-8")
    return input_file_path


def build_render_model(
    request: ValidateRequest,
    input_file_path: pathlib.Path,
    output_folder: pathlib.Path,
    *,
    dont_generate_typst: bool,
    dont_generate_html: bool,
    dont_generate_markdown: bool,
    dont_generate_pdf: bool,
    dont_generate_png: bool,
) -> RenderCVModel:
    """Build validated RenderCV model from web request payload.

    Args:
        request: Validate or render request payload.
        input_file_path: Temporary path representing request input file.
        output_folder: Base output directory for generated files.
        dont_generate_typst: Disable Typst generation.
        dont_generate_html: Disable HTML generation.
        dont_generate_markdown: Disable Markdown generation.
        dont_generate_pdf: Disable PDF generation.
        dont_generate_png: Disable PNG generation.

    Returns:
        Validated RenderCVModel.
    """
    _, rendercv_model = build_rendercv_dictionary_and_model(
        request.main_yaml,
        input_file_path=input_file_path,
        design_yaml_file=request.design_yaml,
        locale_yaml_file=request.locale_yaml,
        settings_yaml_file=request.settings_yaml,
        output_folder=output_folder,
        dont_generate_typst=dont_generate_typst,
        dont_generate_html=dont_generate_html,
        dont_generate_markdown=dont_generate_markdown,
        dont_generate_pdf=dont_generate_pdf,
        dont_generate_png=dont_generate_png,
        overrides=request.overrides,
    )
    return rendercv_model


def validate_web_request(request: ValidateRequest, max_yaml_bytes: int) -> None:
    """Validate request payload against RenderCV schema.

    Args:
        request: Validate request payload.
        max_yaml_bytes: Maximum allowed bytes for YAML payload.

    Raises:
        RenderCVUserError: If payload size exceeds limit.
        RenderCVUserValidationError: If validation fails.
    """
    check_yaml_payload_size(request, max_yaml_bytes)

    with tempfile.TemporaryDirectory(prefix="rendercv-web-") as temporary_directory:
        working_directory = pathlib.Path(temporary_directory)
        input_file_path = create_input_file(request.main_yaml, working_directory)
        output_folder = working_directory / "rendercv_output"

        build_render_model(
            request,
            input_file_path,
            output_folder,
            dont_generate_typst=True,
            dont_generate_html=True,
            dont_generate_markdown=True,
            dont_generate_pdf=True,
            dont_generate_png=True,
        )


def check_artifact_size(file_path: pathlib.Path, max_artifact_bytes: int) -> None:
    """Validate artifact file size against configured maximum.

    Args:
        file_path: Artifact file path.
        max_artifact_bytes: Maximum bytes per artifact file.

    Raises:
        RenderCVUserError: If artifact exceeds size limit.
    """
    file_size = file_path.stat().st_size
    if file_size > max_artifact_bytes:
        raise RenderCVUserError(
            message=(
                f"Generated file `{file_path.name}` is too large ({file_size} bytes). "
                f"Maximum allowed file size is {max_artifact_bytes} bytes."
            )
        )


def build_text_artifact(
    file_path: pathlib.Path,
    *,
    artifact_format: ArtifactFormat,
    media_type: str,
    max_artifact_bytes: int,
) -> RenderedArtifact:
    """Build API artifact for UTF-8 text output files."""
    check_artifact_size(file_path, max_artifact_bytes)
    content = file_path.read_text(encoding="utf-8")
    return RenderedArtifact(
        format=artifact_format,
        filename=file_path.name,
        media_type=media_type,
        encoding="utf-8",
        content=content,
    )


def build_binary_artifact(
    file_path: pathlib.Path,
    *,
    artifact_format: ArtifactFormat,
    media_type: str,
    max_artifact_bytes: int,
) -> RenderedArtifact:
    """Build API artifact for binary outputs encoded as base64."""
    check_artifact_size(file_path, max_artifact_bytes)
    binary_content = file_path.read_bytes()
    encoded_content = base64.b64encode(binary_content).decode("ascii")
    return RenderedArtifact(
        format=artifact_format,
        filename=file_path.name,
        media_type=media_type,
        encoding="base64",
        content=encoded_content,
    )


def render_web_request(
    request: RenderRequest,
    max_yaml_bytes: int,
    max_artifact_bytes: int,
) -> list[RenderedArtifact]:
    """Render requested artifacts from web payload.

    Why:
        This is the API-first orchestration layer that adapts RenderCV's core
        pipeline to web requests and returns artifacts inline for immediate use.

    Args:
        request: Render request payload.
        max_yaml_bytes: Maximum allowed bytes for YAML payload.
        max_artifact_bytes: Maximum bytes allowed per generated artifact.

    Returns:
        List of generated artifacts.
    """
    check_yaml_payload_size(request, max_yaml_bytes)

    generate_typst_output = (
        request.formats.include_typst
        or request.formats.include_pdf
        or request.formats.include_png
    )
    generate_markdown_output = (
        request.formats.include_markdown or request.formats.include_html
    )

    with tempfile.TemporaryDirectory(prefix="rendercv-web-") as temporary_directory:
        working_directory = pathlib.Path(temporary_directory)
        input_file_path = create_input_file(request.main_yaml, working_directory)
        output_folder = working_directory / "rendercv_output"

        rendercv_model = build_render_model(
            request,
            input_file_path,
            output_folder,
            dont_generate_typst=not generate_typst_output,
            dont_generate_html=not request.formats.include_html,
            dont_generate_markdown=not generate_markdown_output,
            dont_generate_pdf=not request.formats.include_pdf,
            dont_generate_png=not request.formats.include_png,
        )

        typst_path = generate_typst(rendercv_model)
        pdf_path = generate_pdf(rendercv_model, typst_path)
        png_paths = generate_png(rendercv_model, typst_path)
        markdown_path = generate_markdown(rendercv_model)
        html_path = generate_html(rendercv_model, markdown_path)

        artifacts: list[RenderedArtifact] = []

        if request.formats.include_typst and typst_path is not None:
            artifacts.append(
                build_text_artifact(
                    typst_path,
                    artifact_format="typst",
                    media_type="text/plain; charset=utf-8",
                    max_artifact_bytes=max_artifact_bytes,
                )
            )

        if request.formats.include_pdf and pdf_path is not None:
            artifacts.append(
                build_binary_artifact(
                    pdf_path,
                    artifact_format="pdf",
                    media_type="application/pdf",
                    max_artifact_bytes=max_artifact_bytes,
                )
            )

        if request.formats.include_png and png_paths is not None:
            for png_path in png_paths:
                artifacts.append(
                    build_binary_artifact(
                        png_path,
                        artifact_format="png",
                        media_type="image/png",
                        max_artifact_bytes=max_artifact_bytes,
                    )
                )

        if request.formats.include_markdown and markdown_path is not None:
            artifacts.append(
                build_text_artifact(
                    markdown_path,
                    artifact_format="markdown",
                    media_type="text/markdown; charset=utf-8",
                    max_artifact_bytes=max_artifact_bytes,
                )
            )

        if request.formats.include_html and html_path is not None:
            artifacts.append(
                build_text_artifact(
                    html_path,
                    artifact_format="html",
                    media_type="text/html; charset=utf-8",
                    max_artifact_bytes=max_artifact_bytes,
                )
            )

        return artifacts
