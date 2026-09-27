#!/usr/bin/env python3
"""
TCP Browser - standalone desktop shell.

Opens the TCP Browser web app in a native OS webview window instead of a full
browser chrome. This is a launcher, not a rendering engine: all page fetching,
tracker stripping and sanitising still happens in the TCP Browser server
(`server.ts`), so the server must be reachable.

Usage
-----
    # 1. start the TCP Browser server in another terminal
    npm install && npm run dev

    # 2. run this shell
    pip install pywebview
    python tcp_desktop_app.py

Point it at a different server with a flag or an environment variable:

    python tcp_desktop_app.py --url https://tcp-browser.example.com
    TCP_BROWSER_URL=http://127.0.0.1:3101 python tcp_desktop_app.py

If pywebview (or a usable GUI backend) is unavailable, the script falls back to
opening the same URL in the system default browser.
"""

from __future__ import annotations

import argparse
import os
import sys
import urllib.error
import urllib.request
import webbrowser

DEFAULT_URL = os.environ.get("TCP_BROWSER_URL", "http://127.0.0.1:3000")
WINDOW_TITLE = "TCP Browser"


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="TCP Browser desktop shell")
    parser.add_argument(
        "--url",
        default=DEFAULT_URL,
        help=f"TCP Browser server URL (default: {DEFAULT_URL})",
    )
    parser.add_argument("--width", type=int, default=1280, help="Window width (default: 1280)")
    parser.add_argument("--height", type=int, default=820, help="Window height (default: 820)")
    parser.add_argument(
        "--debug",
        action="store_true",
        help="Enable the webview developer tools",
    )
    parser.add_argument(
        "--no-check",
        action="store_true",
        help="Skip the startup reachability probe of the server",
    )
    return parser.parse_args(argv)


def probe_server(url: str, timeout: float = 2.5) -> bool:
    """Return True when the TCP Browser health endpoint answers at `url`."""
    base = url.rstrip("/")
    for candidate in (f"{base}/api/health", base):
        try:
            with urllib.request.urlopen(candidate, timeout=timeout) as response:
                if 200 <= response.status < 400:
                    return True
        except (urllib.error.URLError, OSError, ValueError):
            continue
    return False


def open_in_system_browser(url: str) -> int:
    print(f"[tcp-browser] Opening {url} in your default browser.")
    try:
        opened = webbrowser.open(url)
    except Exception as exc:  # pragma: no cover - platform dependent
        print(f"[tcp-browser] Could not open a browser automatically: {exc}")
        return 1
    if not opened:
        print("[tcp-browser] No browser available. Open the URL above manually.")
        return 1
    return 0


def run_webview(url: str, width: int, height: int, debug: bool) -> int:
    import webview  # imported lazily so the fallback path needs no dependency

    webview.create_window(
        title=WINDOW_TITLE,
        url=url,
        width=width,
        height=height,
        min_size=(640, 480),
        confirm_close=False,
        text_select=True,
    )
    # private_mode defaults to True and storage_path to None, so no persistent
    # profile is written for the shell itself. The browsing session state lives
    # in the TCP Browser server process, not here.
    webview.start(private_mode=True, debug=debug)
    return 0


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)
    url = args.url.rstrip("/")

    if not args.no_check and not probe_server(url):
        print(f"[tcp-browser] No TCP Browser server answered at {url}")
        print("[tcp-browser] Start it first, for example:  npm install && npm run dev")

    try:
        return run_webview(url, args.width, args.height, args.debug)
    except ImportError:
        print("[tcp-browser] pywebview is not installed (pip install pywebview).")
        return open_in_system_browser(url)
    except Exception as exc:
        # Covers WebViewException when no GTK/Qt/WebKit2 backend is present on
        # Linux, which is a different failure from a missing package.
        print(f"[tcp-browser] Native window unavailable: {exc}")
        return open_in_system_browser(url)


if __name__ == "__main__":
    sys.exit(main())
