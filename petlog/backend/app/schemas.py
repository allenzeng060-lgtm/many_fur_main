"""Compatibility shim: re-export symbols from `schemas_fixed`.

Some modules import `app.schemas`. The project keeps the working schemas
in `schemas_fixed.py`; exposing them here avoids ImportError without changing
the rest of the codebase.
"""
from .schemas_fixed import *  # noqa: F401, F403

__all__ = [name for name in dir() if not name.startswith("_")]
