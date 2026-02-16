# backend/app/models.py
from __future__ import annotations

import uuid
from datetime import datetime, date

from sqlalchemy import (
    Date,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    func,
    JSON, # Generic JSON
    Uuid, # Generic UUID (SQLAlchemy 2.0+)
)
# from sqlalchemy.dialects.postgresql import UUID, JSONB # Removed
from sqlalchemy.orm import Mapped, mapped_column, relationship

JSONB = JSON # Alias for compatibility
UUID = Uuid # Alias for compatibility


from .db import Base


class Pet(Base):
    __tablename__ = "pets"
    __table_args__ = {"extend_existing": True}  # ✅ 避免重複定義殘留

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)

    name: Mapped[str] = mapped_column(String(80), nullable=False)
    species: Mapped[str] = mapped_column(String(20), nullable=False)
    breed: Mapped[str | None] = mapped_column(String(80), nullable=True)
    sex: Mapped[str | None] = mapped_column(String(10), nullable=True)
    avatar_url: Mapped[str | None] = mapped_column(String(500), nullable=True)

    # ✅ DB 是 date：一定要用 Date
    birth_date: Mapped[date | None] = mapped_column(Date, nullable=True)

    # client_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), unique=True, nullable=False) # Deprecated
    client_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True) # Keep nullable for legacy support if needed

    owner_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=True) # Should be False but True for migration ease/draft

    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    events: Mapped[list["Event"]] = relationship(
        back_populates="pet",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )

    care_plans: Mapped[list["PetCarePlan"]] = relationship(
        back_populates="pet",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )

    owner: Mapped["User"] = relationship(back_populates="pets")


class Event(Base):
    __tablename__ = "events"
    __table_args__ = {"extend_existing": True}

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)

    pet_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("pets.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    type: Mapped[str] = mapped_column(String(30), nullable=False)
    happened_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    title: Mapped[str | None] = mapped_column(String(200), nullable=True)
    note: Mapped[str | None] = mapped_column(Text, nullable=True)

    value: Mapped[dict | list | str | int | float | bool | None] = mapped_column(JSONB, nullable=True)
    images: Mapped[list[str] | None] = mapped_column(JSONB, nullable=True)

    # client_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), unique=True, nullable=False)
    client_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)

    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    pet: Mapped["Pet"] = relationship(back_populates="events")


class PetCarePlan(Base):
    __tablename__ = "pet_care_plans"
    __table_args__ = {"extend_existing": True}

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    pet_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("pets.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    code: Mapped[str] = mapped_column(String(50), nullable=False, default="custom")
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    category: Mapped[str] = mapped_column(String(50), nullable=False, default="custom")
    
    interval_days: Mapped[int] = mapped_column(Integer, nullable=False, default=365)
    last_date: Mapped[date | None] = mapped_column(Date, nullable=True) # Manual override or legacy

    enabled: Mapped[bool] = mapped_column(default=True)
    note: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Automation fields
    anchor_event_type: Mapped[str | None] = mapped_column(String(50), nullable=True)
    anchor_title_keywords: Mapped[list[str] | None] = mapped_column(JSONB, nullable=True)
    override_last_done_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # client_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), unique=True, nullable=False)
    client_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)

    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    pet: Mapped["Pet"] = relationship(back_populates="care_plans")


class User(Base):
    __tablename__ = "users"
    __table_args__ = {"extend_existing": True}

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    avatar_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    is_superuser: Mapped[bool] = mapped_column(default=False)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )

    pets: Mapped[list["Pet"]] = relationship(back_populates="owner")


# ========== AI Pet Finding Models (From pet_finding_export) ==========

class PetReport(Base):
    __tablename__ = "pet_reports"
    __table_args__ = {"extend_existing": True}

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    type: Mapped[str] = mapped_column(String(20), index=True)  # lost / found
    status: Mapped[str] = mapped_column(String(20), default="open", index=True)  # open / resolved

    # Image
    image_path: Mapped[str] = mapped_column(String(255))

    # Owner
    user_id: Mapped[str] = mapped_column(String(100), index=True)

    # Basic Info
    name: Mapped[str | None] = mapped_column(String(80), nullable=True)
    species: Mapped[str] = mapped_column(String(20))  # cat / dog / other
    breed: Mapped[str | None] = mapped_column(String(80), nullable=True)
    sex: Mapped[str | None] = mapped_column(String(20), nullable=True) # male/female/neutered
    age: Mapped[str | None] = mapped_column(String(50), nullable=True) # e.g. 3 years
    size: Mapped[str | None] = mapped_column(String(50), nullable=True) # e.g. 10kg
    
    # Visuals
    color: Mapped[str | None] = mapped_column(String(50), nullable=True)
    features: Mapped[str | None] = mapped_column(Text, nullable=True)  # Detailed visual features

    # Location & Time
    lat: Mapped[float] = mapped_column(Float)
    lng: Mapped[float] = mapped_column(Float)
    last_seen_location: Mapped[str | None] = mapped_column(String(255), nullable=True) # Landmark/Address
    region: Mapped[str | None] = mapped_column(String(50), nullable=True, index=True) # Auto-mapped (North, South, etc.)
    lost_time: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    direction: Mapped[str | None] = mapped_column(String(100), nullable=True) # Running direction

    # Relationship
    images: Mapped[list["PetImage"]] = relationship(
        back_populates="report",
        cascade="all, delete-orphan"
    )

    comments: Mapped[list["ReportComment"]] = relationship(
        back_populates="report", cascade="all, delete-orphan", order_by="desc(ReportComment.created_at)"
    )

    # Behavior
    personality: Mapped[str | None] = mapped_column(Text, nullable=True)
    approach_method: Mapped[str | None] = mapped_column(Text, nullable=True)

    # ID & Accessories
    collar: Mapped[str | None] = mapped_column(String(100), nullable=True)
    microchip_id: Mapped[str | None] = mapped_column(String(50), nullable=True)
    has_tag: Mapped[bool | None] = mapped_column(default=False)
    
    # Contact
    contact_name: Mapped[str | None] = mapped_column(String(80), nullable=True)
    contact_phone: Mapped[str | None] = mapped_column(String(100), nullable=True)
    reward: Mapped[str | None] = mapped_column(String(100), nullable=True)

    # Description
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )


class PetImage(Base):
    __tablename__ = "pet_images"
    __table_args__ = {"extend_existing": True}

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    report_id: Mapped[int] = mapped_column(ForeignKey("pet_reports.id", ondelete="CASCADE"), index=True)
    image_path: Mapped[str] = mapped_column(String(255))
    
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    report: Mapped["PetReport"] = relationship(back_populates="images")


class ReportComment(Base):
    __tablename__ = "report_comments"
    __table_args__ = {"extend_existing": True}

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    report_id: Mapped[int] = mapped_column(ForeignKey("pet_reports.id", ondelete="CASCADE"), index=True)
    
    user_id: Mapped[str] = mapped_column(String(100)) # Simple user ID for now
    content: Mapped[str] = mapped_column(Text)
    
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    report: Mapped["PetReport"] = relationship(back_populates="comments")


