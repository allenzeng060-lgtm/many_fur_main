from app.db import SessionLocal
from app.models import PetReport
from sqlalchemy import select, desc

def check_recent_reports():
    db = SessionLocal()
    try:
        # Get the 5 most recent reports
        stmt = select(PetReport).order_by(desc(PetReport.created_at)).limit(5)
        reports = db.execute(stmt).scalars().all()
        
        print(f"Found {len(reports)} reports in DB:")
        for r in reports:
            print(f"ID: {r.id}, Type: {r.type}, Status: {r.status}, Created: {r.created_at}, User: {r.user_id}")
            print(f"  Description: {r.description}")
            print(f"  Image: {r.image_path}")
            print("-" * 30)
            
    except Exception as e:
        print(f"Error checking DB: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    check_recent_reports()
