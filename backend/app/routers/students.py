import re
from pathlib import Path

from fastapi import APIRouter, BackgroundTasks, Depends, File, HTTPException, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from .. import graph
from ..config import get_settings
from ..db import SessionLocal, get_db
from ..deps import current_user, require_role
from ..matching.engine import rank_key
from ..matching.service import match_pair, rank_opportunities_for_student
from ..models import STUDENT_GOALS, Opportunity, PastProject, StudentProfile, StudentSkill, User
from ..schemas import StudentProfileIn
from ..serializers import opportunity_out, portfolio, rating_summary, skill_name, student_out
from ..skills_catalog import DOMAINS, SKILL_BY_ID

router = APIRouter(prefix="/api/students", tags=["students"])

CV_TYPES = {".pdf", ".doc", ".docx", ".odt"}
CV_MAX_BYTES = 5 * 1024 * 1024


def _profile(db: Session, user_id: int) -> StudentProfile:
    p = db.get(StudentProfile, user_id)
    if not p:
        raise HTTPException(404, "Student not found")
    return p


def _sync_graph_bg():
    with SessionLocal() as db:
        graph.safe_sync(db)


@router.get("/me")
def my_profile(user: User = Depends(require_role("student")), db: Session = Depends(get_db)):
    return student_out(db, _profile(db, user.id), private=True)


@router.put("/me")
def update_my_profile(body: StudentProfileIn, bg: BackgroundTasks,
                      user: User = Depends(require_role("student")), db: Session = Depends(get_db)):
    p = _profile(db, user.id)
    if body.name:
        user.name = body.name.strip()
    user.headline = body.headline
    for field in ("university", "faculty", "study_program", "study_level", "year", "city", "bio", "courses",
                  "hours_per_week", "available_from", "available_to", "work_mode", "portfolio_url", "github_url"):
        setattr(p, field, getattr(body, field))
    p.accepted_types = list(dict.fromkeys(body.accepted_types))
    p.goals = [g for g in body.goals if g in STUDENT_GOALS]
    p.domains = [d for d in body.domains if d in DOMAINS]

    unknown = [s.skill_id for s in body.skills if s.skill_id not in SKILL_BY_ID]
    if unknown:
        raise HTTPException(422, f"Unknown skills: {', '.join(unknown)}")
    p.skills.clear()
    db.flush()
    seen = set()
    for s in body.skills:
        if s.skill_id in seen:
            continue
        seen.add(s.skill_id)
        p.skills.append(StudentSkill(skill_id=s.skill_id, level=s.level, wants_to_learn=s.wants_to_learn))
    p.past_projects.clear()
    for pp in body.past_projects:
        p.past_projects.append(PastProject(title=pp.title, description=pp.description, domain=pp.domain, url=pp.url,
                                           skills=[s for s in pp.skills if s in SKILL_BY_ID]))
    db.commit()
    bg.add_task(_sync_graph_bg)
    return student_out(db, p, private=True)


@router.post("/me/cv")
async def upload_cv(file: UploadFile = File(...), user: User = Depends(require_role("student")),
                    db: Session = Depends(get_db)):
    ext = Path(file.filename or "").suffix.lower()
    if ext not in CV_TYPES:
        raise HTTPException(422, "CV must be PDF, DOC, DOCX or ODT")
    data = await file.read()
    if len(data) > CV_MAX_BYTES:
        raise HTTPException(413, "CV must be at most 5 MB")
    folder = Path(get_settings().upload_dir)
    folder.mkdir(parents=True, exist_ok=True)
    safe = re.sub(r"[^A-Za-z0-9._-]", "_", Path(file.filename).name)[:80]
    target = folder / f"cv_{user.id}_{safe}"
    for old in folder.glob(f"cv_{user.id}_*"):
        old.unlink(missing_ok=True)
    target.write_bytes(data)
    p = _profile(db, user.id)
    p.cv_filename = target.name
    db.commit()
    return {"cv_filename": p.cv_filename}


@router.delete("/me/cv")
def delete_cv(user: User = Depends(require_role("student")), db: Session = Depends(get_db)):
    p = _profile(db, user.id)
    for old in Path(get_settings().upload_dir).glob(f"cv_{user.id}_*"):
        old.unlink(missing_ok=True)
    p.cv_filename = ""
    db.commit()
    return {"cv_filename": ""}


@router.get("/{student_id}/cv")
def download_cv(student_id: int, _user: User = Depends(current_user), db: Session = Depends(get_db)):
    p = _profile(db, student_id)
    path = Path(get_settings().upload_dir) / (p.cv_filename or "")
    if not p.cv_filename or not path.is_file():
        raise HTTPException(404, "No CV uploaded")
    return FileResponse(path, filename=p.cv_filename.split("_", 2)[-1])


@router.get("/me/recommendations")
def my_recommendations(type: str | None = None, limit: int = 20, include_incompatible: bool = False, min_score: float = 40,
                       user: User = Depends(require_role("student")), db: Session = Depends(get_db)):
    p = _profile(db, user.id)
    q = db.query(Opportunity).filter(Opportunity.status == "open")
    if type:
        q = q.filter(Opportunity.type == type)
    opps = {o.id: o for o in q.all()}
    ranked = rank_opportunities_for_student(db, p, list(opps.values()))
    if not include_incompatible:
        ranked = [r for r in ranked if r["status"] != "incompatible" and r["score"] >= min_score]
    return [opportunity_out(db, opps[r["opportunity_id"]], match=r) for r in ranked[:limit]]


@router.get("")
def search_students(q: str = "", skill: str | None = None, min_level: int = 1, type: str | None = None,
                    opportunity_id: int | None = None, user: User = Depends(require_role("company", "university")),
                    db: Session = Depends(get_db)):
    """Talent search. With opportunity_id the AI match against that opportunity is attached and used for sorting."""
    profiles = db.query(StudentProfile).all()
    opp = db.get(Opportunity, opportunity_id) if opportunity_id else None
    if opp and user.role == "company" and opp.company_id != user.id:
        raise HTTPException(403, "Not your opportunity")
    out = []
    needle = q.lower().strip()
    for p in profiles:
        levels = {s.skill_id: s.level for s in p.skills}
        if skill and levels.get(skill, 0) < min_level:
            continue
        if type and type not in (p.accepted_types or []):
            continue
        hay = " ".join([p.user.name, p.user.headline, p.bio, p.university, p.study_program,
                        *[skill_name(s) for s in levels]]).lower()
        if needle and needle not in hay:
            continue
        pf = portfolio(db, p.user_id)
        out.append({
            "id": p.user_id, "name": p.user.name, "headline": p.user.headline, "university": p.university,
            "study_program": p.study_program, "year": p.year, "city": p.city, "accepted_types": p.accepted_types,
            "top_skills": [{"skill_id": s.skill_id, "name": skill_name(s.skill_id), "level": s.level}
                           for s in sorted(p.skills, key=lambda s: -s.level) if s.level > 0][:6],
            "completed_projects": pf["completed"], "rating": rating_summary(db, p.user_id)["average"],
            "match": match_pair(db, p, opp) if opp else None,
        })
    if opp:
        out.sort(key=lambda s: rank_key(s["match"]))
    else:
        out.sort(key=lambda s: (-s["completed_projects"], -(s["rating"] or 0), s["name"]))
    return out


@router.get("/{student_id}")
def public_profile(student_id: int, _user: User = Depends(current_user), db: Session = Depends(get_db)):
    return student_out(db, _profile(db, student_id))
