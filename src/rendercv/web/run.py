import os

import uvicorn


def parse_port(port_value: str | None) -> int:
    """Parse server port from environment text value.

    Args:
        port_value: Port value from environment variable.

    Returns:
        Parsed TCP port with fallback default.
    """
    if port_value is None:
        return 8000

    try:
        return int(port_value)
    except ValueError:
        return 8000


def main() -> None:
    """Run RenderCV web API with Uvicorn.

    Why:
        Provides a stable executable entrypoint (`rendercv-web`) so the web API
        can be launched directly in local/dev environments and cloud runners.
    """
    host = os.getenv("RENDERCV_WEB_HOST", "127.0.0.1")
    port = parse_port(os.getenv("RENDERCV_WEB_PORT"))
    log_level = os.getenv("RENDERCV_WEB_LOG_LEVEL", "info")

    uvicorn.run("rendercv.web.api:app", host=host, port=port, log_level=log_level)


if __name__ == "__main__":
    main()
