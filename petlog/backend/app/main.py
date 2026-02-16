from datetime import datetime

import uuid
import shutil
import os
from typing import Annotated
from pathlib import Path
from dotenv import load_dotenv
load_dotenv()

from fastapi import Depends, FastAPI, HTTPException, Request, Header, UploadFile, File
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from .db import engine, get_db
from .models import Base, Pet, Event, PetCarePlan, User, PetReport, ReportComment, PetImage
from .schemas_fixed import (
    PetCreate, PetUpdate, PetOut,
    EventCreate, EventUpdate, EventOut,
    CarePlanCreate, CarePlanOut,
    PetReportCreate, PetReportOut, PetReportLite,
    CommentCreate, CommentOut,
    PetReportMatchResponse,
    PetImageOut
)
import numpy as np
import cv2
import traceback
from sqlalchemy import select, or_, desc
from sqlalchemy.orm import joinedload
from fastapi import Form
from . import ml_utils

from .routers.auth import router as auth_router, get_current_user
from .routers.care import router as care_router
from .routers.admin import router as admin_router

app = FastAPI(title="PetLog API (PostgreSQL)", version="0.1.0")

from fastapi.middleware.cors import CORSMiddleware

# CORS - read from environment variable, default to common dev origins
# For development, also allow localhost with any port
ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", "http://localhost:8081,http://localhost:19000,http://localhost:3000,exp://localhost:8081,http://127.0.0.1:8081").split(",")

# Add wildcard for development if needed
if os.getenv("DEV_MODE") == "true":
    ALLOWED_ORIGINS.append("*")

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(admin_router)
app.include_router(auth_router)
app.include_router(care_router)

# Base.metadata.create_all(bind=engine) # moved to reset_db or handled manually

# ---------------------------------------------------------
# Static Files & Uploads
# ---------------------------------------------------------
UPLOAD_DIR = Path("static/uploads")
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

app.mount("/static", StaticFiles(directory="static"), name="static")


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    return JSONResponse(status_code=500, content={"error": "Internal Server Error", "detail": str(exc)})


@app.post("/upload")
async def upload_file(file: UploadFile = File(...)):
    try:
        file_ext = file.filename.split(".")[-1] if "." in file.filename else "jpg"
        filename = f"{uuid.uuid4()}.{file_ext}"
        file_path = UPLOAD_DIR / filename
        
        with file_path.open("wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
            
        return {"url": f"/static/uploads/{filename}"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/health")
def health():
    return {"ok": True}


# ---------------------------------------------------------
# Helper: Require Pet/Event Ownership
# ---------------------------------------------------------

def _require_pet_owned(db: Session, pet_id: int, user: User) -> Pet:
    pet = db.query(Pet).filter(Pet.id == pet_id, Pet.deleted_at.is_(None)).first()
    if not pet:
        raise HTTPException(status_code=404, detail="Pet not found")
    if not user.is_superuser and pet.owner_id != user.id:
        raise HTTPException(status_code=403, detail="Forbidden: You do not own this pet")
    return pet


def _require_event_owned(db: Session, event_id: int, user: User) -> Event:
    ev = db.query(Event).filter(Event.id == event_id, Event.deleted_at.is_(None)).first()
    if not ev:
        raise HTTPException(status_code=404, detail="Event not found")
    
    # Check via Pet ownership (Event -> Pet -> Owner)
    pet = db.query(Pet).filter(Pet.id == ev.pet_id).first()
    if not user.is_superuser:
        if not pet or pet.owner_id != user.id:
             raise HTTPException(status_code=403, detail="Forbidden: You do not own this event")
    
    return ev


# ---------------------------------------------------------
# API Endpoints (Authenticated)
# ---------------------------------------------------------

@app.get("/pets", response_model=list[PetOut])
def list_pets(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Session = Depends(get_db)
):
    query = db.query(Pet).filter(Pet.deleted_at.is_(None))
    if not current_user.is_superuser:
        query = query.filter(Pet.owner_id == current_user.id)
        
    return query.order_by(Pet.id.desc()).all()


@app.post("/pets", response_model=PetOut)
def create_pet(
    payload: PetCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Session = Depends(get_db)
):
    pet = Pet(
        name=payload.name,
        species=payload.species,
        breed=payload.breed,
        sex=getattr(payload, "sex", None),
        birth_date=getattr(payload, "birth_date", None),
        avatar_url=getattr(payload, "avatar_url", None),
        owner_id=current_user.id,
        # client_id=... # No longer using client_id
    )
    db.add(pet)
    try:
        db.commit()
    except IntegrityError as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=f"IntegrityError: {str(e)}")
    db.refresh(pet)
    return pet


@app.get("/pets/{pet_id}", response_model=PetOut)
def get_pet(
    pet_id: int, 
    current_user: Annotated[User, Depends(get_current_user)],
    db: Session = Depends(get_db)
):
    return _require_pet_owned(db, pet_id, current_user)


@app.patch("/pets/{pet_id}", response_model=PetOut)
def update_pet(
    pet_id: int,
    payload: PetUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Session = Depends(get_db)
):
    pet = _require_pet_owned(db, pet_id, current_user)
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(pet, k, v)
    db.add(pet)
    db.commit()
    db.refresh(pet)
    return pet


@app.delete("/pets/{pet_id}")
def delete_pet(
    pet_id: int, 
    current_user: Annotated[User, Depends(get_current_user)],
    db: Session = Depends(get_db)
):
    pet = _require_pet_owned(db, pet_id, current_user)
    pet.deleted_at = pet.updated_at
    db.add(pet)
    db.commit()
    return {"ok": True}


# ---------- Events ----------

@app.get("/pets/{pet_id}/events", response_model=list[EventOut])
def list_events(
    pet_id: int, 
    current_user: Annotated[User, Depends(get_current_user)],
    db: Session = Depends(get_db)
):
    _require_pet_owned(db, pet_id, current_user)
    return (
        db.query(Event)
        .filter(Event.pet_id == pet_id, Event.deleted_at.is_(None))
        .order_by(Event.happened_at.desc())
        .all()
    )


@app.post("/pets/{pet_id}/events", response_model=EventOut)
def create_event(
    pet_id: int, 
    payload: EventCreate, 
    current_user: Annotated[User, Depends(get_current_user)],
    db: Session = Depends(get_db)
):
    pet = _require_pet_owned(db, pet_id, current_user)

    ev = Event(
        pet_id=pet_id,
        type=payload.type,
        happened_at=payload.happened_at,
        title=payload.title,
        note=payload.note,
        value=payload.value,
        images=payload.images, # ✅ Add images
        # client_id=pet.client_id 
    )
    db.add(ev)
    db.commit()
    db.refresh(ev)
    return ev


@app.patch("/events/{event_id}", response_model=EventOut)
def update_event(
    event_id: int, 
    payload: EventUpdate, 
    current_user: Annotated[User, Depends(get_current_user)],
    db: Session = Depends(get_db)
):
    ev = _require_event_owned(db, event_id, current_user)

    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(ev, k, v)

    db.add(ev)
    db.commit()
    db.refresh(ev)
    return ev


@app.delete("/events/{event_id}")
def delete_event(
    event_id: int, 
    current_user: Annotated[User, Depends(get_current_user)],
    db: Session = Depends(get_db)
):
    ev = _require_event_owned(db, event_id, current_user)
    ev.deleted_at = ev.updated_at
    db.add(ev)
    db.commit()
    return {"ok": True}


# ==========================================
# 🚀 AI Pet Finding Features (Ported)
# ==========================================

@app.middleware("http")
async def catch_exceptions_middleware(request: Request, call_next):
    try:
        return await call_next(request)
    except Exception:
        traceback.print_exc()
        return JSONResponse(status_code=500, content={"detail": "Global Error", "traceback": traceback.format_exc()})

@app.post("/api/reports/lost", response_model=PetReportOut)
async def create_lost_report(
    user_id: str = Form(...),
    lat: float = Form(...),
    lng: float = Form(...),
    
    species: str = Form(...),
    name: str = Form(None),
    breed: str = Form(None),
    sex: str = Form(None),
    age: str = Form(None),
    size: str = Form(None),
    
    color: str = Form(None),
    features: str = Form(None),
    
    last_seen_location: str = Form(None),
    region: str = Form(None),
    lost_time: str = Form(None), 
    direction: str = Form(None),
    
    personality: str = Form(None),
    approach_method: str = Form(None),
    
    collar: str = Form(None),
    microchip_id: str = Form(None),
    has_tag: bool = Form(False),
    
    contact_name: str = Form(None),
    contact_phone: str = Form(None),
    reward: str = Form(None),
    
    description: str = Form(None),
    files: list[UploadFile] = File(...),
    db: Session = Depends(get_db)
):
    try:
        # 1. Save Images
        saved_images = []
        
        for file in files:
            file_ext = file.filename.split(".")[-1] if file.filename else "jpg"
            filename = f"lost_{user_id}_{int(datetime.now().timestamp())}_{uuid.uuid4().hex[:6]}.{file_ext}"
            file_path = UPLOAD_DIR / filename
            
            with open(file_path, "wb") as buffer:
                shutil.copyfileobj(file.file, buffer)
            
            # Save as relative path for frontend access
            relative_path = f"static/uploads/{filename}"
            saved_images.append(relative_path)

        primary_image_path = saved_images[0] if saved_images else ""

        # 2. Parse Time
        parsed_lost_time = None
        if lost_time:
            try:
                parsed_lost_time = datetime.fromisoformat(lost_time.replace('Z', '+00:00'))
            except:
                pass 
            
        # 3. Create DB Entry
        report = PetReport(
            type="lost",
            status="open",
            user_id=user_id,
            lat=lat,
            lng=lng,
            image_path=primary_image_path,
            
            species=species,
            name=name,
            breed=breed,
            sex=sex,
            age=age,
            size=size,
            
            color=color,
            features=features,
            
            last_seen_location=last_seen_location,
            region=region,
            lost_time=parsed_lost_time,
            direction=direction,
            
            personality=personality,
            approach_method=approach_method,
            
            collar=collar,
            microchip_id=microchip_id,
            has_tag=has_tag,
            
            contact_name=contact_name,
            contact_phone=contact_phone,
            reward=reward,
            
            description=description
        )
        db.add(report)
        db.commit()
        db.refresh(report)

        # 4. Create PetImage entries
        for img_path in saved_images:
            pet_image = PetImage(report_id=report.id, image_path=img_path)
            db.add(pet_image)
        
        db.commit()
        db.refresh(report)

        return report
    except Exception as e:
        traceback.print_exc()
        return JSONResponse(status_code=500, content={"detail": str(e), "traceback": traceback.format_exc()})


@app.post("/api/analyze")
async def analyze_image_only(
    file: UploadFile = File(...)
):
    try:
        content = await file.read()
        nparr = np.frombuffer(content, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

        try:
            crop_img, label = ml_utils.get_best_crop(img)
        except Exception as e:
            print(f"YOLO Failed: {e}")
            crop_img = img
            label = "unknown"
        
        if crop_img is None:
            crop_img = img
            label = "unknown"
            
        ai_result = ml_utils.analyze_with_openai(crop_img)
        
        if label != "unknown" and (not ai_result.get("species") or ai_result.get("species") == "other"):
            ai_result["species"] = label
            
        return ai_result
        
    except Exception as e:
        traceback.print_exc()
        return JSONResponse(status_code=500, content={"detail": str(e)})


@app.post("/api/reports/found", response_model=PetReportOut)
async def create_found_report(
    user_id: str = Form(...),
    lat: float = Form(...),
    lng: float = Form(...),
    
    species: str = Form(None),
    breed: str = Form(None),
    color: str = Form(None),
    sex: str = Form(None),
    size: str = Form(None), 
    features: str = Form(None),
    description: str = Form(None),
    
    last_seen_location: str = Form(None),
    region: str = Form(None),
    lost_time: str = Form(None), 
    
    collar: str = Form(None),
    microchip_id: str = Form(None),
    has_tag: bool = Form(False),

    contact_name: str = Form(None),
    contact_phone: str = Form(None),
    
    files: list[UploadFile] = File(...),
    db: Session = Depends(get_db)
):
    saved_images = []
    
    for idx, file in enumerate(files):
        file_ext = file.filename.split(".")[-1] if file.filename else "jpg"
        filename = f"found_{user_id}_{int(datetime.now().timestamp())}_{uuid.uuid4().hex[:6]}.{file_ext}"
        file_path = UPLOAD_DIR / filename
        
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        
        relative_path = f"static/uploads/{filename}"
        saved_images.append(relative_path)

    primary_image_path = saved_images[0] if saved_images else ""

    parsed_lost_time = None
    if lost_time:
        try:
             parsed_lost_time = datetime.fromisoformat(lost_time.replace('Z', '+00:00'))
        except:
             pass

    report = PetReport(
        type="found",
        status="open",
        user_id=user_id,
        lat=lat,
        lng=lng,
        image_path=primary_image_path,
        
        species=species or "unknown",
        breed=breed,
        color=color,
        sex=sex,
        size=size,
        features=features,
        description=description,
        
        last_seen_location=last_seen_location,
        region=region,
        lost_time=parsed_lost_time,
        
        collar=collar,
        microchip_id=microchip_id,
        has_tag=has_tag,
        
        contact_name=contact_name,
        contact_phone=contact_phone
    )
    db.add(report)
    db.commit()
    db.refresh(report)

    for img_path in saved_images:
        pet_image = PetImage(report_id=report.id, image_path=img_path)
        db.add(pet_image)
    
    db.commit()
    db.refresh(report)
    return report


@app.get("/api/reports", response_model=list[PetReportLite])
def list_reports(
    type: str | None = None,
    user_id: str | None = None,
    species: str | None = None,
    breed: str | None = None,
    sex: str | None = None,
    size: str | None = None,
    location: str | None = None,
    q: str | None = None,
    db: Session = Depends(get_db)
):
    stmt = select(PetReport).options(joinedload(PetReport.images)).order_by(PetReport.created_at.desc())
    if type:
        stmt = stmt.where(PetReport.type == type)
    if user_id:
        stmt = stmt.where(PetReport.user_id == user_id)
    if species:
        stmt = stmt.where(PetReport.species == species)
    if breed:
        stmt = stmt.where(PetReport.breed.ilike(f"%{breed}%"))
    if sex and sex != "all":
        stmt = stmt.where(PetReport.sex == sex)
    if size:
         stmt = stmt.where(PetReport.size.ilike(size))
    if location:
        known_regions = ["北部", "中部", "南部", "東部", "離島"]
        if location in known_regions:
            stmt = stmt.where(PetReport.region == location)
        else:
            stmt = stmt.where(PetReport.last_seen_location.ilike(f"%{location}%"))

    if q:
        terms = q.strip().split()
        if terms:
            for term in terms:
                search_term = f"%{term}%"
                stmt = stmt.where(
                    or_(
                        PetReport.features.ilike(search_term),
                        PetReport.description.ilike(search_term),
                        PetReport.breed.ilike(search_term),
                        PetReport.color.ilike(search_term),
                        PetReport.last_seen_location.ilike(search_term),
                        PetReport.species.ilike(search_term)
                    )
                )
        
    return db.execute(stmt).unique().scalars().all()


@app.get("/api/reports/{report_id}", response_model=PetReportOut)
def get_report(report_id: int, db: Session = Depends(get_db)):
    report = db.execute(
        select(PetReport)
        .options(joinedload(PetReport.images))
        .where(PetReport.id == report_id)
    ).unique().scalar_one_or_none()
    
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
        
    return report


@app.post("/api/reports/{report_id}/comments", response_model=CommentOut)
def create_comment(
    report_id: int, 
    payload: CommentCreate, 
    db: Session = Depends(get_db)
):
    report = db.get(PetReport, report_id)
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
        
    comment = ReportComment(
        report_id=report_id,
        user_id=payload.user_id,
        content=payload.content
    )
    db.add(comment)
    db.commit()
    db.refresh(comment)
    return comment


@app.get("/api/reports/{report_id}/comments", response_model=list[CommentOut])
def list_comments(report_id: int, db: Session = Depends(get_db)):
    stmt = select(ReportComment).where(ReportComment.report_id == report_id).order_by(ReportComment.created_at.desc())
    return db.execute(stmt).scalars().all()


@app.post("/api/reports/{report_id}/match", response_model=list[PetReportMatchResponse])
def align_reports(report_id: int, db: Session = Depends(get_db)):
    lost_report = db.get(PetReport, report_id)
    if not lost_report:
        raise HTTPException(status_code=404, detail="Lost Report not found")
        
    if lost_report.type != "lost":
        raise HTTPException(status_code=400, detail="Only 'lost' reports can use this matching endpoint")

    stmt = select(PetReport).options(joinedload(PetReport.images)).where(
            PetReport.type == "found",
            PetReport.species == lost_report.species,
            PetReport.status == "open"
    )
    
    candidates = db.execute(stmt).unique().scalars().all()
    
    results = []
    
    for candidate in candidates:
        try:
            score, details = ml_utils.calculate_match_score(lost_report, candidate)
            results.append({
                "report": candidate,
                "match_score": score,
                "match_details": details
            })
        except Exception as e:
            print(f"Error matching report {candidate.id}: {e}")
            continue
            
    results.sort(key=lambda x: x["match_score"], reverse=True)
    
    return results[:5]

@app.post("/api/pets/{pet_id}/match-lost", response_model=list[PetReportMatchResponse])
def match_pet_with_lost_reports(pet_id: int, db: Session = Depends(get_db)):
    """
    Match a pet with lost reports - used when viewing pet details
    """
    pet = db.get(Pet, pet_id)
    if not pet:
        raise HTTPException(status_code=404, detail="Pet not found")
    
    # Find lost reports matching this pet's species
    stmt = select(PetReport).options(joinedload(PetReport.images)).where(
        PetReport.type == "lost",
        PetReport.species == pet.species,
        PetReport.status == "open"
    )
    
    candidates = db.execute(stmt).unique().scalars().all()
    
    results = []
    
    # Create a temporary report-like object from pet data for matching
    # This allows us to reuse the existing matching logic
    class PetAsReport:
        def __init__(self, pet):
            self.species = pet.species
            self.breed = pet.breed
            self.sex = 'male' if pet.sex == 'M' else 'female' if pet.sex == 'F' else 'unknown'
            self.lat = None  # Pet doesn't have location
            self.lng = None
            self.features = ""  # Could be expanded with pet notes/description
            self.color = None
            self.microchip_id = None
    
    pet_as_report = PetAsReport(pet)
    
    for candidate in candidates:
        try:
            score, details = ml_utils.calculate_match_score(pet_as_report, candidate)
            results.append({
                "report": candidate,
                "match_score": score,
                "match_details": details
            })
        except Exception as e:
            print(f"Error matching pet {pet_id} with report {candidate.id}: {e}")
            continue
    
    results.sort(key=lambda x: x["match_score"], reverse=True)
    
    return results[:5]

@app.delete("/api/reports/{report_id}")
def delete_report(report_id: int, db: Session = Depends(get_db)):
    report = db.get(PetReport, report_id)
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    
    # Delete Image File
    try:
        if report.image_path and os.path.exists(report.image_path):
            os.remove(report.image_path)
    except Exception as e:
        print(f"Error deleting file for report {report_id}: {e}")

    db.delete(report)
    db.commit()
    return {"ok": True, "deleted": report_id}
