"""Compatibility subset of Python's removed pipes module.

The pinned Chromium depot_tools and WebRTC sources only use pipes.quote.
Python 3.13 removed pipes, while shlex.quote is its supported replacement.
"""

from shlex import quote

__all__ = ["quote"]
