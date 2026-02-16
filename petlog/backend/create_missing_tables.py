from app.db import engine, Base
from app.models import PetReport, PetImage, ReportComment

print("Creating missing tables...")
Base.metadata.create_all(bind=engine)
print("Tables created (if they didn't exist).")
