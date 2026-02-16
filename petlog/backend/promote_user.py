from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.models import User
from app.db import SQLALCHEMY_DATABASE_URL
import sys

def promote_user(email):
    engine = create_engine(SQLALCHEMY_DATABASE_URL)
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    db = SessionLocal()

    try:
        user = db.query(User).filter(User.email == email).first()
        if not user:
            print(f"User with email {email} not found.")
            return

        user.is_superuser = True
        db.commit()
        print(f"User {email} promoted to superuser.")
    finally:
        db.close()

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python promote_user.py <email>")
        sys.exit(1)
    
    promote_user(sys.argv[1])
