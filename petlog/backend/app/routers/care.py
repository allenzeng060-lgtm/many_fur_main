from __future__ import annotations

from datetime import date, timedelta, datetime
import uuid
from typing import Optional, Literal

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import select, and_

from ..db import get_db
from ..models import Pet, Event, PetCarePlan
from ..schemas import (
    CarePlanCreate,
    CarePlanUpdate,
    CarePlanOut,
    ReminderOut,
)

router = APIRouter(tags=["care"])


def _defaults_for_species(species: Optional[str]) -> list[dict]:
    # 你可以後續加更多項目，例如：洗牙、心絲蟲、回診…
    if species == "dog":
        return [
            {"code": "rabies", "name": "狂犬病", "category": "vaccine", "interval_days": 365, "anchor_event_type": "vaccine", "keywords": ["狂犬", "rabies"]},
            {"code": "core_combo", "name": "核心十合一", "category": "vaccine", "interval_days": 365, "anchor_event_type": "vaccine", "keywords": ["十合一", "核心"]},
            {"code": "parasite", "name": "體內外寄生蟲預防", "category": "med", "interval_days": 30, "anchor_event_type": "med", "keywords": ["寄生蟲", "驅蟲", "除蚤", "滴劑", "口服"]},
        ]
    if species == "cat":
        return [
            {"code": "rabies", "name": "狂犬病", "category": "vaccine", "interval_days": 365, "anchor_event_type": "vaccine", "keywords": ["狂犬", "rabies"]},
            {"code": "core_combo", "name": "三合一核心", "category": "vaccine", "interval_days": 365, "anchor_event_type": "vaccine", "keywords": ["三合一", "核心"]},
            {"code": "parasite", "name": "體內外寄生蟲預防", "category": "med", "interval_days": 30, "anchor_event_type": "med", "keywords": ["寄生蟲", "驅蟲", "除蚤", "滴劑", "口服"]},
        ]
    # 未知物種：至少給驅蟲
    return [
        {"code": "parasite", "name": "體內外寄生蟲預防", "category": "med", "interval_days": 30, "anchor_event_type": "med", "keywords": ["寄生蟲", "驅蟲", "除蚤", "滴劑", "口服"]},
    ]


def _pick_last_done_from_events(events: list[Event], keywords: list[str]) -> Optional[datetime]:
    """
    從 events 裡找「最後一次」符合 keywords 的紀錄。
    規則：title 或 note 只要包含任一 keyword 就算。
    """
    if not events:
        return None
    kw = [k.lower() for k in (keywords or []) if k]
    if not kw:
        # 沒設 keywords → 直接取最近一筆
        return events[0].happened_at

    for ev in events:
        t = (ev.title or "").lower()
        n = (ev.note or "").lower()
        if any(k in t or k in n for k in kw):
            return ev.happened_at
    return None


@router.post("/pets/{pet_id}/care-plans/bootstrap", response_model=list[CarePlanOut])
def bootstrap_care_plans(pet_id: int, db: Session = Depends(get_db)):
    """
    依 pet.species 自動建立預設提醒項目（狂犬病/核心疫苗/驅蟲）。
    已存在則更新名稱/週期，不覆蓋使用者手動填的 override_last_done_at。
    """
    pet = db.get(Pet, pet_id)
    if (not pet) or pet.deleted_at is not None:
        raise HTTPException(status_code=404, detail="Pet not found")

    defaults = _defaults_for_species(pet.species)

    for d in defaults:
        stmt = select(PetCarePlan).where(
            and_(
                PetCarePlan.pet_id == pet_id,
                PetCarePlan.code == d["code"],
                PetCarePlan.deleted_at.is_(None),
            )
        )
        plan = db.execute(stmt).scalars().first()
        if plan:
            plan.name = d["name"]
            plan.category = d["category"]
            plan.interval_days = int(d["interval_days"])
            plan.anchor_event_type = d["anchor_event_type"]
            plan.anchor_title_keywords = d["keywords"]
            plan.enabled = True
        else:
            plan = PetCarePlan(
                pet_id=pet_id,
                code=d["code"],
                name=d["name"],
                category=d["category"],
                interval_days=int(d["interval_days"]),
                anchor_event_type=d["anchor_event_type"],
                anchor_title_keywords=d["keywords"],
                enabled=True,
                client_id=uuid.uuid4(),
            )
            db.add(plan)

    db.commit()

    stmt2 = (
        select(PetCarePlan)
        .where(PetCarePlan.pet_id == pet_id)
        .where(PetCarePlan.deleted_at.is_(None))
        .order_by(PetCarePlan.id.asc())
    )
    plans = db.execute(stmt2).scalars().all()
    return plans


@router.get("/pets/{pet_id}/care-plans", response_model=list[CarePlanOut])
def list_care_plans(pet_id: int, db: Session = Depends(get_db)):
    pet = db.get(Pet, pet_id)
    if (not pet) or pet.deleted_at is not None:
        raise HTTPException(status_code=404, detail="Pet not found")

    stmt = (
        select(PetCarePlan)
        .where(PetCarePlan.pet_id == pet_id)
        .where(PetCarePlan.deleted_at.is_(None))
        .order_by(PetCarePlan.id.asc())
    )
    return db.execute(stmt).scalars().all()


@router.post("/pets/{pet_id}/care-plans", response_model=CarePlanOut)
def create_care_plan(pet_id: int, payload: CarePlanCreate, db: Session = Depends(get_db)):
    pet = db.get(Pet, pet_id)
    if (not pet) or pet.deleted_at is not None:
        raise HTTPException(status_code=404, detail="Pet not found")

    data = payload.model_dump()
    code = data["code"].strip().lower()

    stmt = select(PetCarePlan).where(
        and_(
            PetCarePlan.pet_id == pet_id,
            PetCarePlan.code == code,
            PetCarePlan.deleted_at.is_(None),
        )
    )
    exists = db.execute(stmt).scalars().first()
    if exists:
        raise HTTPException(status_code=409, detail="Care plan code already exists")

    plan = PetCarePlan(
        pet_id=pet_id,
        code=code,
        name=data["name"].strip(),
        category=data.get("category") or "custom",
        interval_days=int(data["interval_days"]),
        enabled=True,
        note=data.get("note"),
        anchor_event_type=data.get("anchor_event_type") or None,
        anchor_title_keywords=data.get("anchor_title_keywords") or [],
        override_last_done_at=data.get("override_last_done_at"),
        client_id=uuid.uuid4(),
    )
    db.add(plan)
    db.commit()
    db.refresh(plan)
    return plan


@router.patch("/care-plans/{plan_id}", response_model=CarePlanOut)
def update_care_plan(plan_id: int, payload: CarePlanUpdate, db: Session = Depends(get_db)):
    plan = db.get(PetCarePlan, plan_id)
    if (not plan) or plan.deleted_at is not None:
        raise HTTPException(status_code=404, detail="Care plan not found")

    data = payload.model_dump(exclude_unset=True)
    for k, v in data.items():
        setattr(plan, k, v)

    db.commit()
    db.refresh(plan)
    return plan


@router.delete("/care-plans/{plan_id}")
def delete_care_plan(plan_id: int, db: Session = Depends(get_db)):
    plan = db.get(PetCarePlan, plan_id)
    if (not plan) or plan.deleted_at is not None:
        raise HTTPException(status_code=404, detail="Care plan not found")

    plan.deleted_at = datetime.utcnow()
    db.commit()
    return {"deleted": True, "plan_id": plan_id}


@router.get("/pets/{pet_id}/reminders", response_model=list[ReminderOut])
def get_reminders(pet_id: int, db: Session = Depends(get_db)):
    """
    回傳「已計算」的提醒清單：
    - last_done_at：override 優先，否則從 events 找
    - next_due_at / days_left / status 由後端統一算好
    """
    pet = db.get(Pet, pet_id)
    if (not pet) or pet.deleted_at is not None:
        raise HTTPException(status_code=404, detail="Pet not found")

    plans_stmt = (
        select(PetCarePlan)
        .where(PetCarePlan.pet_id == pet_id)
        .where(PetCarePlan.deleted_at.is_(None))
        .where(PetCarePlan.enabled.is_(True))
        .order_by(PetCarePlan.id.asc())
    )
    plans = db.execute(plans_stmt).scalars().all()

    out: list[ReminderOut] = []
    for p in plans:
        last_done_at = p.override_last_done_at

        if last_done_at is None and p.anchor_event_type:
            ev_stmt = (
                select(Event)
                .where(Event.pet_id == pet_id)
                .where(Event.deleted_at.is_(None))
                .where(Event.type == p.anchor_event_type)
                .order_by(Event.happened_at.desc())
                .limit(50)
            )
            evs = db.execute(ev_stmt).scalars().all()
            last_done_at = _pick_last_done_from_events(evs, p.anchor_title_keywords or [])

        if last_done_at is None:
            out.append(
                ReminderOut(
                    plan_id=p.id,
                    code=p.code,
                    name=p.name,
                    category=p.category,
                    interval_days=p.interval_days,
                    last_done_at=None,
                    next_due_at=None,
                    days_left=None,
                    status="no_last_date",
                )
            )
            continue

        next_due_at = (last_done_at.date() + timedelta(days=p.interval_days))
        days_left = (next_due_at - date.today()).days

        if days_left < 0:
            status: Literal["overdue", "due_soon", "ok", "no_last_date"] = "overdue"
        elif days_left <= 7:
            status = "due_soon"
        else:
            status = "ok"

        out.append(
            ReminderOut(
                plan_id=p.id,
                code=p.code,
                name=p.name,
                category=p.category,
                interval_days=p.interval_days,
                last_done_at=last_done_at,
                next_due_at=next_due_at,
                days_left=days_left,
                status=status,
            )
        )

    return out
