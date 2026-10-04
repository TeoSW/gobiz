from fastapi import Depends, Header, HTTPException
from sqlalchemy.orm import Session

from .db import get_db
from .models import InteractionEvent, User


def current_user(x_user_id: int | None = Header(default=None), db: Session = Depends(get_db)) -> User:
    """Prototype identity: the persona switcher sends X-User-Id. Replace with real auth (OIDC/JWT) later."""
    if x_user_id is None:
        raise HTTPException(401, "Choose a demo persona (X-User-Id header missing)")
    user = db.get(User, x_user_id)
    if not user:
        raise HTTPException(401, "Unknown user")
    return user


def optional_user(x_user_id: int | None = Header(default=None), db: Session = Depends(get_db)) -> User | None:
    return db.get(User, x_user_id) if x_user_id else None


def require_role(*roles: str):
    def checker(user: User = Depends(current_user)) -> User:
        if user.role not in roles:
            raise HTTPException(403, f"Only {' / '.join(roles)} accounts can do this")
        return user

    return checker


def log_event(db: Session, event: str, actor_id: int, student_id: int | None = None,
              opportunity_id: int | None = None, match_score: float | None = None, value: float | None = None) -> None:
    db.add(InteractionEvent(event=event, actor_id=actor_id, student_id=student_id, opportunity_id=opportunity_id,
                            match_score=match_score, value=value))
