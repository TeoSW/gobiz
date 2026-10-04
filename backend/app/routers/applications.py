from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..db import get_db
from ..deps import log_event, require_role
from ..models import Application, User
from ..schemas import RespondIn
from ..serializers import iso, opportunity_out

router = APIRouter(prefix="/api/applications", tags=["applications"])


@router.get("/mine")
def my_applications(user: User = Depends(require_role("student")), db: Session = Depends(get_db)):
    apps = db.query(Application).filter(Application.student_id == user.id).order_by(Application.created_at.desc()).all()
    return [
        {"id": a.id, "kind": a.kind, "status": a.status, "message": a.message, "match_score": a.match_score,
         "created_at": iso(a.created_at), "opportunity": opportunity_out(db, a.opportunity)}
        for a in apps
    ]


@router.post("/{app_id}/respond")
def respond(app_id: int, body: RespondIn, user: User = Depends(require_role("student")), db: Session = Depends(get_db)):
    a = db.get(Application, app_id)
    if not a or a.student_id != user.id:
        raise HTTPException(404, "Not found")
    if body.action in ("accept", "decline"):
        if a.kind != "invitation" or a.status != "pending":
            raise HTTPException(409, "Only pending invitations can be accepted or declined")
        a.status = "accepted" if body.action == "accept" else "declined"
        log_event(db, f"invite_{a.status}", user.id, user.id, a.opportunity_id, a.match_score)
    else:
        if a.status not in ("pending", "accepted"):
            raise HTTPException(409, "Cannot withdraw now")
        a.status = "withdrawn"
        log_event(db, "withdrawn", user.id, user.id, a.opportunity_id, a.match_score)
    db.commit()
    return {"id": a.id, "kind": a.kind, "status": a.status}
