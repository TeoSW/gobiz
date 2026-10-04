from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from .. import graph
from ..config import get_settings
from ..db import get_db
from ..deps import current_user
from ..llm.providers import OllamaProvider
from ..matching.embeddings import embedder
from ..models import STUDENT_GOALS, InteractionEvent, User
from ..serializers import user_brief
from ..skills_catalog import DOMAINS, SKILLS

router = APIRouter(prefix="/api", tags=["meta"])


@router.get("/health")
def health():
    return {"ok": True}


@router.get("/system/status")
def system_status(db: Session = Depends(get_db)):
    s = get_settings()
    llm = {"provider": s.llm_provider, "fallback": "heuristic"}
    if s.llm_provider == "ollama":
        llm |= OllamaProvider(s.ollama_url, s.ollama_model, 3, s.ollama_num_ctx).status()
    db_kind = s.database_url.split(":", 1)[0]
    return {
        "database": {"driver": db_kind, "users": db.query(User).count(),
                     "interaction_events": db.query(InteractionEvent).count()},
        "llm": llm,
        "embeddings": embedder.status(),
        "graph": graph.status(),
        "weights": {"skills": s.w_skills, "experience": s.w_experience, "interests": s.w_interests, "semantic": s.w_semantic},
    }


@router.get("/personas")
def personas(db: Session = Depends(get_db)):
    users = db.query(User).order_by(User.role, User.id).all()
    return [user_brief(u) for u in users]


@router.get("/me")
def me(user: User = Depends(current_user)):
    return user_brief(user)


@router.get("/meta")
def meta():
    return {
        "skills": [{"id": s["id"], "name": s["name"], "category": s["category"], "esco_hint": s["esco_hint"]} for s in SKILLS],
        "domains": DOMAINS,
        "goals": list(STUDENT_GOALS),
        "types": ["project", "internship", "job"],
    }


@router.post("/system/reset-demo")
def reset_demo():
    from ..seed import reset_and_seed

    reset_and_seed()
    return {"ok": True}
