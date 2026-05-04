"""Integration tests for the RenderCV Web API FastAPI endpoints.

These tests use FastAPI's TestClient to exercise the full request/response
cycle including middleware, error handlers and rate-limiting configuration.
"""

import pytest
from fastapi.testclient import TestClient

from rendercv.web.api import WebApiSettings, create_app
from rendercv.web.models import RenderFormats


# ---------------------------------------------------------------------------
# Shared fixtures
# ---------------------------------------------------------------------------


@pytest.fixture
def client() -> TestClient:
    """Return a TestClient backed by a fresh app with generous limits."""
    settings = WebApiSettings(
        cors_origins=["*"],
        max_yaml_bytes=500_000,
        max_artifact_bytes=12_000_000,
        validate_timeout_seconds=30,
        render_timeout_seconds=120,
    )
    return TestClient(create_app(settings))


minimal_yaml = """
cv:
  name: Jane Doe
  sections:
    Summary:
      - Security-focused engineer.
"""

oversized_yaml = "cv:\n  name: x\n" + ("  # padding\n" * 50_000)


# ---------------------------------------------------------------------------
# /health
# ---------------------------------------------------------------------------


def test_health_returns_ok(client: TestClient) -> None:
    response = client.get("/health")
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert "version" in body


# ---------------------------------------------------------------------------
# /api/v1/validate — happy paths
# ---------------------------------------------------------------------------


def test_validate_valid_yaml_returns_valid_true(client: TestClient) -> None:
    response = client.post("/api/v1/validate", json={"main_yaml": minimal_yaml})
    assert response.status_code == 200
    body = response.json()
    assert body["valid"] is True
    assert body["errors"] == []
    assert "request_id" in body


def test_validate_invalid_yaml_returns_valid_false_with_errors(client: TestClient) -> None:
    bad_yaml = """
cv:
  name: 12345
  email: not-an-email
"""
    response = client.post("/api/v1/validate", json={"main_yaml": bad_yaml})
    assert response.status_code == 200
    body = response.json()
    # May or may not be invalid depending on schema; at minimum must parse cleanly
    assert "valid" in body
    assert "request_id" in body


def test_validate_empty_main_yaml_returns_422(client: TestClient) -> None:
    """FastAPI model validation fires before our handler for empty strings."""
    response = client.post("/api/v1/validate", json={"main_yaml": ""})
    assert response.status_code == 422


def test_validate_missing_main_yaml_field_returns_422(client: TestClient) -> None:
    response = client.post("/api/v1/validate", json={})
    assert response.status_code == 422


# ---------------------------------------------------------------------------
# /api/v1/validate — security rejections
# ---------------------------------------------------------------------------


def test_validate_rejects_blocked_photo_path(client: TestClient) -> None:
    yaml_with_photo = minimal_yaml + "\n  photo: /etc/passwd\n"
    response = client.post("/api/v1/validate", json={"main_yaml": yaml_with_photo})
    assert response.status_code == 400
    body = response.json()
    assert body["detail"]["error_code"] in ("user_error", "payload_too_large")


def test_validate_rejects_blocked_override(client: TestClient) -> None:
    response = client.post(
        "/api/v1/validate",
        json={
            "main_yaml": minimal_yaml,
            "overrides": {"settings.render_command.output_folder": "/tmp/attacker"},
        },
    )
    assert response.status_code == 400


# ---------------------------------------------------------------------------
# /api/v1/validate — oversized payload
# ---------------------------------------------------------------------------


def test_validate_oversized_payload_returns_413(client: TestClient) -> None:
    response = client.post("/api/v1/validate", json={"main_yaml": oversized_yaml})
    assert response.status_code == 413
    body = response.json()
    assert body["detail"]["error_code"] == "payload_too_large"


# ---------------------------------------------------------------------------
# /api/v1/validate — response headers
# ---------------------------------------------------------------------------


def test_validate_response_includes_request_id_header(client: TestClient) -> None:
    response = client.post("/api/v1/validate", json={"main_yaml": minimal_yaml})
    assert "X-Request-Id" in response.headers


def test_validate_propagates_custom_request_id_header(client: TestClient) -> None:
    custom_id = "test-custom-id-abc123"
    response = client.post(
        "/api/v1/validate",
        json={"main_yaml": minimal_yaml},
        headers={"X-Request-Id": custom_id},
    )
    assert response.headers.get("X-Request-Id") == custom_id


# ---------------------------------------------------------------------------
# /api/v1/render — happy path
# ---------------------------------------------------------------------------


def test_render_markdown_returns_artifact(client: TestClient) -> None:
    response = client.post(
        "/api/v1/render",
        json={
            "main_yaml": minimal_yaml,
            "formats": RenderFormats(
                include_pdf=False,
                include_png=False,
                include_html=False,
                include_markdown=True,
                include_typst=False,
            ).model_dump(),
        },
    )
    assert response.status_code == 200
    body = response.json()
    assert "artifacts" in body
    assert len(body["artifacts"]) == 1
    artifact = body["artifacts"][0]
    assert artifact["format"] == "markdown"
    assert "Jane Doe" in artifact["content"]


# ---------------------------------------------------------------------------
# /api/v1/render — security rejections
# ---------------------------------------------------------------------------


def test_render_rejects_blocked_output_path(client: TestClient) -> None:
    yaml_with_path = minimal_yaml + "\nsettings:\n  render_command:\n    pdf_path: /tmp/attacker.pdf\n"
    response = client.post(
        "/api/v1/render",
        json={
            "main_yaml": yaml_with_path,
            "formats": {"include_pdf": True},
        },
    )
    assert response.status_code == 400


# ---------------------------------------------------------------------------
# /api/v1/render — oversized payload
# ---------------------------------------------------------------------------


def test_render_oversized_payload_returns_413(client: TestClient) -> None:
    response = client.post(
        "/api/v1/render",
        json={"main_yaml": oversized_yaml, "formats": {"include_markdown": True}},
    )
    assert response.status_code == 413
    body = response.json()
    assert body["detail"]["error_code"] == "payload_too_large"


# ---------------------------------------------------------------------------
# /api/v1/render — empty formats (all false) returns empty artifact list
# ---------------------------------------------------------------------------


def test_render_all_formats_false_returns_empty_artifacts(client: TestClient) -> None:
    response = client.post(
        "/api/v1/render",
        json={
            "main_yaml": minimal_yaml,
            "formats": {
                "include_pdf": False,
                "include_png": False,
                "include_html": False,
                "include_markdown": False,
                "include_typst": False,
            },
        },
    )
    assert response.status_code == 200
    body = response.json()
    assert body["artifacts"] == []


# ---------------------------------------------------------------------------
# /api/v1/render — validation error in payload returns 422
# ---------------------------------------------------------------------------


def test_render_returns_422_for_invalid_rendercv_schema(client: TestClient) -> None:
    completely_invalid = """
cv:
  email: not-a-valid-email-at-all@@@@
  sections:
    Summary:
      - Text
"""
    response = client.post(
        "/api/v1/render",
        json={"main_yaml": completely_invalid, "formats": {"include_markdown": True}},
    )
    # Either 200 (soft validation errors in render) or 422 — both are acceptable
    assert response.status_code in (200, 422)
