# backend/app/admin.py
from fastapi import APIRouter, Request
from fastapi.responses import HTMLResponse
from fastapi.templating import Jinja2Templates
from pathlib import Path

router = APIRouter()

BASE_DIR = Path(__file__).resolve().parent
templates = Jinja2Templates(directory=str(BASE_DIR / "templates"))

@router.get("/admin", response_class=HTMLResponse)
def admin_home(request: Request):
    # 先讓頁面能打開（中文介面在 templates/admin.html）
    return templates.TemplateResponse("admin.html", {"request": request})
