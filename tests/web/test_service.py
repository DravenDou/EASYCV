import pathlib

import pytest

from rendercv.exception import RenderCVUserError
from rendercv.web.models import RenderFormats, RenderRequest, ValidateRequest
from rendercv.web.service import render_web_request, validate_web_request


minimal_yaml = """
cv:
  name: Jane Doe
  sections:
    Summary:
      - Security-focused engineer.
"""


@pytest.mark.parametrize(
    "yaml_text",
    [
        """
cv:
  name: Jane Doe
  photo: https://127.0.0.1/internal.png
  sections:
    Summary:
      - Security-focused engineer.
""",
        """
cv:
  name: Jane Doe
  photo: /etc/passwd
  sections:
    Summary:
      - Security-focused engineer.
""",
        """
cv:
  name: Jane Doe
  sections:
    Summary:
      - Security-focused engineer.
settings:
  render_command:
    pdf_path: /tmp/attacker.pdf
""",
        """
cv:
  name: Jane Doe
  sections:
    Summary:
      - Security-focused engineer.
settings:
  render_command:
    design: /etc/passwd
""",
    ],
)
def test_validate_web_request_rejects_server_side_file_and_url_fields(
    yaml_text: str,
) -> None:
    request = ValidateRequest(main_yaml=yaml_text)

    with pytest.raises(RenderCVUserError) as error:
        validate_web_request(request, max_yaml_bytes=500_000)
    assert "not supported by the web API" in error.value.message


def test_validate_web_request_rejects_blocked_settings_overlay_path() -> None:
    request = ValidateRequest(
        main_yaml=minimal_yaml,
        settings_yaml="""
settings:
  render_command:
    html_path: /tmp/attacker.html
""",
    )

    with pytest.raises(RenderCVUserError) as error:
        validate_web_request(request, max_yaml_bytes=500_000)
    assert "not supported by the web API" in error.value.message


def test_validate_web_request_rejects_blocked_override() -> None:
    request = ValidateRequest(
        main_yaml=minimal_yaml,
        overrides={"settings.render_command.output_folder": "/tmp/attacker"},
    )

    with pytest.raises(RenderCVUserError) as error:
        validate_web_request(request, max_yaml_bytes=500_000)
    assert "not supported by the web API" in error.value.message


def test_render_web_request_uses_internal_output_paths() -> None:
    request = RenderRequest(
        main_yaml="""
cv:
  name: /tmp/should_not_be_a_path
  sections:
    Summary:
      - Security-focused engineer.
settings:
  render_command:
    markdown_path: /tmp/attacker.md
""",
        formats=RenderFormats(
            include_pdf=False,
            include_png=False,
            include_html=False,
            include_markdown=True,
            include_typst=False,
        ),
    )

    with pytest.raises(RenderCVUserError) as error:
        render_web_request(
            request,
            max_yaml_bytes=500_000,
            max_artifact_bytes=12_000_000,
        )
    assert "not supported by the web API" in error.value.message


def test_render_web_request_allows_normal_markdown_render() -> None:
    request = RenderRequest(
        main_yaml=minimal_yaml,
        formats=RenderFormats(
            include_pdf=False,
            include_png=False,
            include_html=False,
            include_markdown=True,
            include_typst=False,
        ),
    )

    artifacts = render_web_request(
        request,
        max_yaml_bytes=500_000,
        max_artifact_bytes=12_000_000,
    )

    assert len(artifacts) == 1
    assert artifacts[0].format == "markdown"
    assert artifacts[0].filename == "cv.md"
    assert "Jane Doe" in artifacts[0].content


def test_render_web_request_accepts_frontend_sample_yaml() -> None:
    sample_yaml_path = (
        pathlib.Path(__file__).parents[2] / "frontend" / "public" / "sample-cv.yaml"
    )
    request = RenderRequest(
        main_yaml=sample_yaml_path.read_text(encoding="utf-8"),
        formats=RenderFormats(
            include_pdf=False,
            include_png=False,
            include_html=False,
            include_markdown=True,
            include_typst=False,
        ),
        design_yaml="""
design:
  theme: classic
""",
        locale_yaml="""
locale:
  language: spanish
""",
    )

    artifacts = render_web_request(
        request,
        max_yaml_bytes=500_000,
        max_artifact_bytes=12_000_000,
    )

    assert len(artifacts) == 1
    assert artifacts[0].format == "markdown"
    assert "John Doe" in artifacts[0].content
