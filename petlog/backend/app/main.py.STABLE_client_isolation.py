# backend/app/main.py
from __future__ import annotations

import uuid

from fastapi import Depends, FastAPI, HTTPException, Request, Header
from fastapi.responses import JSONResponse
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from .db import engine, get_db
from .models import Base, Pet, Event, PetCarePlan
from .schemas import (
    PetCreate, PetOut,
    EventCreate, EventUpdate, EventOut,
    CarePlanCreate, CarePlanOut,
)

app = FastAPI(title="PetLog API (PostgreSQL)", version="0.1.0")

# ✅ 你 DB 已有表也沒差；create_all 不會亂刪，只會補缺（但你現在是已存在，就略過）
Base.metadata.create_all(bind=engine)


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    # 開發期：回傳真實錯誤，前端才看得到原因
    return JSONResponse(status_code=500, content={"error": "Internal Server Error", "detail": str(exc)})


@app.get("/health")
def health():
    return {"ok": True}



def _require_client_id(x_client_id: str) -> uuid.UUID:
    try:
        return uuid.UUID(x_client_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid X-Client-Id (must be UUID)")

def get_cid(x_client_id: str = Header(..., alias="X-Client-Id")) -> uuid.UUID:
    return _require_client_id(x_client_id)



def _require_pet_owned(db: Session, pet_id: int, cid: uuid.UUID) -> Pet:
    pet = db.query(Pet).filter(Pet.id == pet_id, Pet.deleted_at.is_(None)).first()
    if not pet:
        raise HTTPException(status_code=404, detail="Pet not found")
    if pet.client_id != cid:
        raise HTTPException(status_code=403, detail="Forbidden")
    return pet


def _require_event_owned(db: Session, event_id: int, cid: uuid.UUID) -> Event:
    ev = db.query(Event).filter(Event.id == event_id, Event.deleted_at.is_(None)).first()
    if not ev:
        raise HTTPException(status_code=404, detail="Event not found")
    if ev.client_id != cid:
        raise HTTPException(status_code=403, detail="Forbidden")
    return ev


@app.post("/pets", response_model=PetOut)

@app.get("/pets", response_model=list[PetOut])
def list_pets(cid: uuid.UUID = Depends(get_cid), db: Session = Depends(get_db)):
    return (
        db.query(Pet)
        .filter(Pet.deleted_at.is_(None), Pet.client_id == cid)
        .order_by(Pet.id.desc())
        .all()
    )


def create_pet(payload: PetCreate, cid: uuid.UUID = Depends(get_cid), db: Session = Depends(get_db)):

    pet = Pet(
        name=payload.name,
        species=payload.species,
        breed=payload.breed,
        sex=payload.sex,
        birth_date=payload.birth_date,  # ✅ date | None（對齊 DB）
        client_id=cid,
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
def get_pet(pet_id: int, cid: uuid.UUID = Depends(get_cid), db: Session = Depends(get_db)):
    return _require_pet_owned(db, pet_id, cid)


@app.delete("/pets/{pet_id}")
def delete_pet(pet_id: int, cid: uuid.UUID = Depends(get_cid), db: Session = Depends(get_db)):
    pet = _require_pet_owned(db, pet_id, cid)
    pet.deleted_at = pet.updated_at  # 你有 updated_at server_default；這邊先用現值
    db.add(pet)
    db.commit()
    return {"ok": True}
# ---------- Events ----------
@app.get("/pets/{pet_id}/events", response_model=list[EventOut])
def list_events(pet_id: int, cid: uuid.UUID = Depends(get_cid), db: Session = Depends(get_db)):
    _require_pet_owned(db, pet_id, cid)
    return (
        db.query(Event)
        .filter(Event.pet_id == pet_id, Event.deleted_at.is_(None), Event.client_id == cid)
        .order_by(Event.happened_at.desc())
        .all()
    )


@app.post("/pets/{pet_id}/events", response_model=EventOut)
def create_event(pet_id: int, payload: EventCreate, cid: uuid.UUID = Depends(get_cid), db: Session = Depends(get_db)):
    pet = _require_pet_owned(db, pet_id, cid)

    ev = Event(
        pet_id=pet_id,
        type=payload.type,
        happened_at=payload.happened_at,
        title=payload.title,
        note=payload.note,
        value=payload.value,
        client_id=pet.client_id  # ✅ use pet.client_id,
    )
    db.add(ev)
    db.commit()
    db.refresh(ev)
    return ev


@app.patch("/events/{event_id}", response_model=EventOut)
def update_event(event_id: int, payload: EventUpdate, cid: uuid.UUID = Depends(get_cid), db: Session = Depends(get_db)):
    ev = _require_event_owned(db, event_id, cid)

    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(ev, k, v)

    db.add(ev)
    db.commit()
    db.refresh(ev)
    return ev


@app.delete("/events/{event_id}")
def delete_event(event_id: int, cid: uuid.UUID = Depends(get_cid), db: Session = Depends(get_db)):
    ev = _require_event_owned(db, event_id, cid)
    ev.deleted_at = ev.updated_at
    db.add(ev)
    db.commit()
    return {"ok": True}


# ---------- Care Plans ----------
@app.get("/pets/{pet_id}/care-plans", response_model=list[CarePlanOut])
def list_care_plans(pet_id: int, cid: uuid.UUID = Depends(get_cid), db: Session = Depends(get_db)):
    _require_pet_owned(db, pet_id, cid)
    return (
        db.query(PetCarePlan)
        .filter(PetCarePlan.pet_id == pet_id, PetCarePlan.deleted_at.is_(None), PetCarePlan.client_id == cid)
        .order_by(PetCarePlan.id.desc())
        .all()
    )


@app.post("/pets/{pet_id}/care-plans", response_model=CarePlanOut)
def create_care_plan(pet_id: int, payload: CarePlanCreate, cid: uuid.UUID = Depends(get_cid), db: Session = Depends(get_db)):
    pet = _require_pet_owned(db, pet_id, cid)

    plan = PetCarePlan(
        pet_id=pet_id,
        name=payload.name,
        interval_days=payload.interval_days,
        last_date=payload.last_date,
        client_id=pet.client_id  # ✅ use pet.client_id,
    )
    db.add(plan)
    db.commit()
    db.refresh(plan)
    return plan
