"""Compatibility wrapper for comment processing pipeline.

Keeping this module path stable while the implementation lives in
`src/comment_capture_pipeline.py`.
"""

from .comment_capture_pipeline import build_process_candidate as _build_process_candidate

build_process_candidate = _build_process_candidate

__all__ = ["build_process_candidate"]
