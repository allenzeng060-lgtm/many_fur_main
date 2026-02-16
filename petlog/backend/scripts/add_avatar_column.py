"""
Safe script to add avatar_url column to pets table if missing.
Run: python scripts/add_avatar_column.py
"""
from __future__ import annotations
import sys
import traceback
from sqlalchemy import text

try:
    from app.db import engine
except Exception as e:
    print("Failed to import app.db:", e)
    sys.exit(1)

with engine.connect() as conn:
    try:
        q = text("SELECT column_name FROM information_schema.columns WHERE table_name='pets' AND column_name='avatar_url'")
        r = conn.execute(q)
        row = r.fetchone()
        if row:
            print('Column avatar_url already exists on pets.')
        else:
            print('Adding avatar_url column to pets...')
            conn.execute(text('ALTER TABLE pets ADD COLUMN avatar_url VARCHAR(500);'))
            print('Done.')
    except Exception:
        print('ERROR while altering table:')
        traceback.print_exc()
        sys.exit(1)
