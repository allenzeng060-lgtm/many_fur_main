from datetime import datetime, timedelta
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from jose import JWTError, jwt
# from passlib.context import CryptContext # Removed usage of passlib
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..db import get_db
from ..models import User
from ..schemas import UserCreate, UserOut, Token, UserLogin, UserUpdate


router = APIRouter(prefix="/auth", tags=["auth"])

import bcrypt
import hashlib

# ---------------------------
# Config
# ---------------------------
# 在真實專案中， SECRET_KEY 應該從 env讀取
SECRET_KEY = "CHANGE_THIS_TO_A_SUPER_SECRET_KEY"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30 * 24 * 60  # 30 days for app

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/token")


# ---------------------------
# Helpers
# ---------------------------
def verify_password(plain_password, hashed_password):
    # Pre-hash with SHA-256 to support long passwords and bypass 72-byte limit
    password_bytes = plain_password.encode('utf-8')
    sha256_bytes = hashlib.sha256(password_bytes).hexdigest().encode('utf-8')
    
    # Ensure hashed_password is bytes
    if isinstance(hashed_password, str):
        hashed_password = hashed_password.encode('utf-8')
        
    return bcrypt.checkpw(sha256_bytes, hashed_password)

def get_password_hash(password):
    # Pre-hash with SHA-256
    password_bytes = password.encode('utf-8')
    sha256_bytes = hashlib.sha256(password_bytes).hexdigest().encode('utf-8')
    
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(sha256_bytes, salt).decode('utf-8')

def create_access_token(data: dict, expires_delta: timedelta | None = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=15)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

async def get_current_user(token: Annotated[str, Depends(oauth2_scheme)], db: Session = Depends(get_db)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email: str = payload.get("sub")
        if email is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
    
    stmt = select(User).where(User.email == email)
    user = db.scalar(stmt)
    if user is None:
        raise credentials_exception
    return user


# ---------------------------
# Routes
# ---------------------------

@router.post("/register", response_model=UserOut)
def register(user_in: UserCreate, db: Session = Depends(get_db)):
    # Check if email exists
    stmt = select(User).where(User.email == user_in.email)
    existing_user = db.scalar(stmt)
    existing_user = db.scalar(stmt)
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")

    # Verify password length (bcrypt limit is 72 bytes) - Handled by SHA256 pre-hashing now
    # if len(user_in.password.encode('utf-8')) > 72:
    #      raise HTTPException(status_code=400, detail="Password must be less than 72 bytes")

    # Create User
    new_user = User(
        email=user_in.email,
        password_hash=get_password_hash(user_in.password),
        name=user_in.name,
        avatar_url=f"https://ui-avatars.com/api/?name={user_in.name}&background=random" 
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user


@router.post("/login", response_model=Token)
def login(user_in: UserLogin, db: Session = Depends(get_db)):
    stmt = select(User).where(User.email == user_in.email)
    user = db.scalar(stmt)
    
    if not user or not verify_password(user_in.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.email, "id": user.id}, 
        expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer"}


@router.get("/me", response_model=UserOut)
def read_users_me(current_user: Annotated[User, Depends(get_current_user)]):
    return current_user


@router.patch("/me", response_model=UserOut)
def update_user_me(
    payload: UserUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Session = Depends(get_db)
):
    """
    Update current user profile.
    """
    if payload.name is not None:
        current_user.name = payload.name
    if payload.avatar_url is not None:
        current_user.avatar_url = payload.avatar_url
    
    if payload.password:
        current_user.password_hash = get_password_hash(payload.password)

    db.add(current_user)
    db.commit()
    db.refresh(current_user)
    return current_user
