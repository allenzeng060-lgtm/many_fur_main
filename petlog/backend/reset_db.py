from app.db import Base, engine
from app.models import User, Pet, Event, PetCarePlan # Import all models to ensure they are registered

print("Dropping all tables...")
try:
    Base.metadata.drop_all(bind=engine)
    print("All tables dropped.")
except Exception as e:
    print(f"Error dropping tables: {e}")

print("Creating all tables...")
try:
    Base.metadata.create_all(bind=engine)
    print("All tables created successfully.")
except Exception as e:
    print(f"Error creating tables: {e}")
