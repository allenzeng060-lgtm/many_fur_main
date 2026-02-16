from __future__ import annotations

from datetime import datetime, date
from typing import Any, Optional, Literal, List, Dict

from pydantic import BaseModel, Field, ConfigDict
from uuid import UUID


# -------------------------
# Pets
# -------------------------
class PetCreate(BaseModel):
    model_config = ConfigDict(extra="ignore")  # ✅ 來自前端多送欄位也不要炸

    name: str = Field(..., min_length=1)
    species: Optional[str] = Field(default=None, description="cat/dog/other (optional)")
    breed: Optional[str] = None
    avatar_url: Optional[str] = None

    # ✅ 你 backend/main.py 目前會用到這些欄位（避免 500）
    sex: Optional[str] = None
    birth_date: Optional[date] = None




class PetUpdate(BaseModel):
    model_config = ConfigDict(extra="ignore")

    name: Optional[str] = None
    species: Optional[str] = None
    breed: Optional[str] = None
    sex: Optional[str] = None
    birth_date: Optional[date] = None
    avatar_url: Optional[str] = None


class PetOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    species: Optional[str] = None
    breed: Optional[str] = None
    is_deleted: bool = False

    # 可選欄位（DB 若有就會帶出，沒有也不會出錯）
    sex: Optional[str] = None
    birth_date: Optional[date] = None
    client_id: Optional[UUID] = None
    owner_id: Optional[int] = None  # ✅ Allow admin to see owner
    avatar_url: Optional[str] = None


# -------------------------
# Events
# -------------------------
EventType = Literal["weight", "vaccine", "visit", "med", "note"]


class EventCreate(BaseModel):
    model_config = ConfigDict(extra="ignore")

    type: EventType
    happened_at: datetime  # ✅ 回傳/接收都用 datetime（FastAPI 會序列化成 ISO 字串）
    title: Optional[str] = None
    note: Optional[str] = None
    value: Optional[Any] = None
    images: Optional[list[str]] = None




class EventUpdate(BaseModel):
    model_config = ConfigDict(extra="ignore")

    type: Optional[EventType] = None
    happened_at: Optional[datetime] = None
    title: Optional[str] = None
    note: Optional[str] = None
    value: Optional[Any] = None
    images: Optional[list[str]] = None


class EventOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    pet_id: int
    type: str
    happened_at: datetime  # ✅ 這樣你 list_events 回傳 datetime 不會再 ResponseValidationError
    title: Optional[str] = None
    note: Optional[str] = None
    value: Optional[Any] = None
    images: Optional[list[str]] = None
    is_deleted: bool = False

# ---------------------------
# CarePlan (保守版 schemas)
# ---------------------------

class CarePlanCreate(BaseModel):
    model_config = ConfigDict(extra="ignore")

    pet_id: Optional[int] = None
    code: str = Field(..., min_length=1) # added
    name: str = Field(..., min_length=1)
    category: Optional[str] = "custom"
    interval_days: int = 365
    
    # Automation / details
    note: Optional[str] = None
    anchor_event_type: Optional[str] = None
    anchor_title_keywords: Optional[List[str]] = None
    override_last_done_at: Optional[datetime] = None

    last_date: Optional[date] = None
    client_id: Optional[UUID] = None

class CarePlanUpdate(BaseModel):
    model_config = ConfigDict(extra="ignore")

    name: Optional[str] = None
    category: Optional[str] = None
    interval_days: Optional[int] = None
    note: Optional[str] = None
    
    anchor_event_type: Optional[str] = None
    anchor_title_keywords: Optional[List[str]] = None
    override_last_done_at: Optional[datetime] = None
    
    last_date: Optional[date] = None


class CarePlanOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    pet_id: int
    code: str
    name: str
    category: str
    interval_days: int
    
    enabled: bool = True
    note: Optional[str] = None
    anchor_event_type: Optional[str] = None
    anchor_title_keywords: Optional[List[str]] = None
    override_last_done_at: Optional[datetime] = None

    last_date: Optional[date] = None
    client_id: Optional[UUID] = None
    updated_at: Optional[datetime] = None
    deleted_at: Optional[datetime] = None


# ---------------------------
# User / Auth
# ---------------------------
class UserCreate(BaseModel):
    email: str
    password: str
    name: str

class UserLogin(BaseModel):
    email: str
    password: str


class UserUpdate(BaseModel):
    name: Optional[str] = None
    avatar_url: Optional[str] = None
    password: Optional[str] = None  # If we want to allow password change here, otherwise remove


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    
    id: int
    email: str
    name: str
    avatar_url: Optional[str] = None
    is_superuser: bool = False
    created_at: datetime

class Token(BaseModel):
    access_token: str
    token_type: str


class ReminderOut(BaseModel):
    plan_id: int
    code: str
    name: str
    category: str
    interval_days: int
    last_done_at: Optional[datetime] = None
    next_due_at: Optional[date] = None
    days_left: Optional[int] = None
    status: Literal["overdue", "due_soon", "ok", "no_last_date"]


# ---------------------------
# Admin / User Management
# ---------------------------
class UserAdminOut(BaseModel):
    """Extended user info for admin with statistics"""
    model_config = ConfigDict(from_attributes=True)
    
    id: int
    email: str
    name: str
    avatar_url: Optional[str] = None
    is_superuser: bool = False
    created_at: datetime
    updated_at: datetime
    
    # Statistics
    pet_count: int = 0
    event_count: int = 0


class UserAdminUpdate(BaseModel):
    """Schema for admin to update user information"""
    name: Optional[str] = None
    avatar_url: Optional[str] = None
    is_superuser: Optional[bool] = None


class PasswordReset(BaseModel):
    """Schema for password reset requests"""
    new_password: str = Field(..., min_length=6)


# -------------------------
# Pet Report (Lost & Found)
# -------------------------
class PetReportCreate(BaseModel):
    user_id: str
    type: Literal["lost", "found"]
    lat: float
    lng: float
    
    species: Literal["cat", "dog", "other"]
    name: Optional[str] = None
    breed: Optional[str] = None
    sex: Optional[str] = None
    age: Optional[str] = None
    size: Optional[str] = None
    
    color: Optional[str] = None
    features: Optional[str] = None
    
    last_seen_location: Optional[str] = None
    region: Optional[str] = None
    lost_time: Optional[datetime] = None
    direction: Optional[str] = None
    
    personality: Optional[str] = None
    approach_method: Optional[str] = None
    
    collar: Optional[str] = None
    microchip_id: Optional[str] = None
    has_tag: Optional[bool] = None
    
    contact_name: Optional[str] = None
    contact_phone: Optional[str] = None
    reward: Optional[str] = None
    
    description: Optional[str] = None


class PetImageOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    image_path: str


class PetReportOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    type: Optional[str] = None
    status: Optional[str] = None
    image_path: Optional[str] = None
    images: List[PetImageOut] = []
    
    name: Optional[str] = None
    species: Optional[str] = None
    breed: Optional[str] = None
    sex: Optional[str] = None
    age: Optional[str] = None
    size: Optional[str] = None
    
    color: Optional[str] = None
    features: Optional[str] = None
    
    lat: Optional[float] = None
    lng: Optional[float] = None
    last_seen_location: Optional[str] = None
    region: Optional[str] = None
    lost_time: Optional[datetime] = None
    direction: Optional[str] = None
    
    personality: Optional[str] = None
    approach_method: Optional[str] = None
    
    collar: Optional[str] = None
    microchip_id: Optional[str] = None
    has_tag: Optional[bool] = None
    
    contact_name: Optional[str] = None
    contact_phone: Optional[str] = None
    reward: Optional[str] = None
    
    user_id: Optional[str] = None
    description: Optional[str] = None
    created_at: Optional[datetime] = None


class PetReportLite(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    type: str # lost/found
    status: str
    image_path: str
    name: Optional[str] = None  # Pet name (for lost pets)
    species: str
    breed: Optional[str] = None
    sex: Optional[str] = None
    lat: float
    lng: float
    last_seen_location: Optional[str] = None
    created_at: datetime
    
    # Added for List View details
    description: Optional[str] = None
    reward: Optional[str] = None
    features: Optional[str] = None
    size: Optional[str] = None
    color: Optional[str] = None
    region: Optional[str] = None


# -------------------------
# Comments
# -------------------------
class CommentCreate(BaseModel):
    user_id: str
    content: str


class CommentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: str
    content: str
    created_at: datetime


class PetReportMatchResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    report: PetReportOut
    match_score: int
    match_details: dict
