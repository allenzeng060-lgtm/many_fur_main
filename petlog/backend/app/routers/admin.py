from typing import Annotated, List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, func
from sqlalchemy.orm import Session

from ..db import get_db
from ..models import User, Pet, Event
from ..schemas import UserAdminOut, UserAdminUpdate, PasswordReset
from .auth import get_current_user, get_password_hash


router = APIRouter(prefix="/admin", tags=["admin"])


# Helper to verify superuser access
async def get_current_superuser(
    current_user: Annotated[User, Depends(get_current_user)]
) -> User:
    if not current_user.is_superuser:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only superusers can access this endpoint"
        )
    return current_user


@router.get("/users", response_model=List[UserAdminOut])
async def list_all_users(
    current_user: Annotated[User, Depends(get_current_superuser)],
    db: Session = Depends(get_db)
):
    """
    List all users in the system with their statistics.
    Only accessible by superusers.
    """
    # Get all users
    stmt = select(User)
    users = db.scalars(stmt).all()
    
    # For each user, get pet and event counts
    result = []
    for user in users:
        pet_count = db.scalar(
            select(func.count(Pet.id))
            .where(Pet.owner_id == user.id)
            .where(Pet.deleted_at.is_(None))
        ) or 0
        
        # Count events for this user's pets
        event_count = db.scalar(
            select(func.count(Event.id))
            .join(Pet, Event.pet_id == Pet.id)
            .where(Pet.owner_id == user.id)
            .where(Event.deleted_at.is_(None))
        ) or 0
        
        user_data = UserAdminOut(
            id=user.id,
            email=user.email,
            name=user.name,
            avatar_url=user.avatar_url,
            is_superuser=user.is_superuser,
            created_at=user.created_at,
            updated_at=user.updated_at,
            pet_count=pet_count,
            event_count=event_count
        )
        result.append(user_data)
    
    return result


@router.get("/users/{user_id}", response_model=UserAdminOut)
async def get_user_details(
    user_id: int,
    current_user: Annotated[User, Depends(get_current_superuser)],
    db: Session = Depends(get_db)
):
    """
    Get detailed information about a specific user.
    Only accessible by superusers.
    """
    stmt = select(User).where(User.id == user_id)
    user = db.scalar(stmt)
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Get pet and event counts
    pet_count = db.scalar(
        select(func.count(Pet.id))
        .where(Pet.owner_id == user.id)
        .where(Pet.deleted_at.is_(None))
    ) or 0
    
    event_count = db.scalar(
        select(func.count(Event.id))
        .join(Pet, Event.pet_id == Pet.id)
        .where(Pet.owner_id == user.id)
        .where(Event.deleted_at.is_(None))
    ) or 0
    
    return UserAdminOut(
        id=user.id,
        email=user.email,
        name=user.name,
        avatar_url=user.avatar_url,
        is_superuser=user.is_superuser,
        created_at=user.created_at,
        updated_at=user.updated_at,
        pet_count=pet_count,
        event_count=event_count
    )


@router.patch("/users/{user_id}", response_model=UserAdminOut)
async def update_user(
    user_id: int,
    payload: UserAdminUpdate,
    current_user: Annotated[User, Depends(get_current_superuser)],
    db: Session = Depends(get_db)
):
    """
    Update user information (name, avatar, superuser status).
    Only accessible by superusers.
    """
    stmt = select(User).where(User.id == user_id)
    user = db.scalar(stmt)
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Update fields if provided
    if payload.name is not None:
        user.name = payload.name
    if payload.avatar_url is not None:
        user.avatar_url = payload.avatar_url
    if payload.is_superuser is not None:
        user.is_superuser = payload.is_superuser
    
    db.add(user)
    db.commit()
    db.refresh(user)
    
    # Get statistics
    pet_count = db.scalar(
        select(func.count(Pet.id))
        .where(Pet.owner_id == user.id)
        .where(Pet.deleted_at.is_(None))
    ) or 0
    
    event_count = db.scalar(
        select(func.count(Event.id))
        .join(Pet, Event.pet_id == Pet.id)
        .where(Pet.owner_id == user.id)
        .where(Event.deleted_at.is_(None))
    ) or 0
    
    return UserAdminOut(
        id=user.id,
        email=user.email,
        name=user.name,
        avatar_url=user.avatar_url,
        is_superuser=user.is_superuser,
        created_at=user.created_at,
        updated_at=user.updated_at,
        pet_count=pet_count,
        event_count=event_count
    )


@router.patch("/users/{user_id}/password", response_model=dict)
async def reset_user_password(
    user_id: int,
    payload: PasswordReset,
    current_user: Annotated[User, Depends(get_current_superuser)],
    db: Session = Depends(get_db)
):
    """
    Reset a user's password to a new value.
    Only accessible by superusers.
    """
    stmt = select(User).where(User.id == user_id)
    user = db.scalar(stmt)
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Update password
    user.password_hash = get_password_hash(payload.new_password)
    
    db.add(user)
    db.commit()
    
    return {
        "message": "Password reset successfully",
        "user_id": user.id,
        "email": user.email
    }


@router.delete("/users/{user_id}", response_model=dict)
async def delete_user(
    user_id: int,
    current_user: Annotated[User, Depends(get_current_superuser)],
    db: Session = Depends(get_db)
):
    """
    Delete a user account (hard delete).
    Only accessible by superusers.
    """
    if user_id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete your own account"
        )
    
    stmt = select(User).where(User.id == user_id)
    user = db.scalar(stmt)
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Delete the user (cascade will handle related records)
    db.delete(user)
    db.commit()
    
    return {
        "message": "User deleted successfully",
        "user_id": user_id,
        "email": user.email
    }
