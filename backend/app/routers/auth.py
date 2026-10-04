"""Mockup login. It checks username + password, then the frontend sends X-User-Id on every request.

This is NOT secure (any client can send any X-User-Id); it only makes the prototype feel like a real app.
Next step for production: OIDC (e.g. Keycloak, Apache-2.0) and a signed token instead of the header.
"""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..db import get_db
from ..models import User
from ..security import verify_password
from ..seed import COMPANIES, DEMO_ACCOUNTS, STUDENTS, UNIVERSITY
from ..serializers import user_brief

router = APIRouter(prefix="/api/auth", tags=["auth"])


class LoginIn(BaseModel):
    username: str
    password: str


@router.post("/login")
def login(body: LoginIn, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == body.username.strip().lower()).first()
    if not user or not verify_password(body.password, user.password_hash):
        raise HTTPException(401, "Wrong username or password")
    return user_brief(user)


@router.get("/demo-accounts")
def demo_accounts():
    """The test accounts shown on the login page (demo only)."""
    names = {e["key"]: (e["name"], role) for role, group in (("student", STUDENTS), ("company", COMPANIES),
                                                               ("university", UNIVERSITY)) for e in group}
    return [
        {"name": names[key][0], "role": names[key][1], "username": username, "password": password}
        for key, (username, password) in DEMO_ACCOUNTS.items()
    ]
