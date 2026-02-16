"""
Create missing tables without dropping existing data.
Run: python scripts/create_missing_tables.py
"""
from __future__ import annotations
import sys
import traceback

try:
    from app.db import engine
    from app.models import Base
except Exception as e:
    print("Failed to import app package:", e)
    sys.exit(1)

try:
    print('Creating missing tables (if any)...')
    Base.metadata.create_all(bind=engine)
    print('Done.')
except Exception:
    print('ERROR while creating tables:')
    traceback.print_exc()
    sys.exit(1)
