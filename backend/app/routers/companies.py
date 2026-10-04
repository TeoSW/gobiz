from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..db import get_db
from ..deps import current_user, require_role
from ..models import CompanyProfile, Opportunity, User
from ..schemas import CompanyProfileIn
from ..serializers import company_out, opportunity_out

router = APIRouter(prefix="/api/companies", tags=["companies"])


@router.get("/me")
def my_company(user: User = Depends(require_role("company")), db: Session = Depends(get_db)):
    return company_out(db, user)


@router.put("/me")
def update_my_company(body: CompanyProfileIn, user: User = Depends(require_role("company")), db: Session = Depends(get_db)):
    cp = db.get(CompanyProfile, user.id) or CompanyProfile(user_id=user.id)
    if body.name:
        user.name = body.name.strip()
    user.headline = body.headline
    for field in ("industry", "size", "city", "website", "description"):
        setattr(cp, field, getattr(body, field))
    db.add(cp)
    db.commit()
    return company_out(db, user)


@router.get("/{company_id}")
def company(company_id: int, _user: User = Depends(current_user), db: Session = Depends(get_db)):
    u = db.get(User, company_id)
    if not u or u.role != "company":
        raise HTTPException(404, "Company not found")
    out = company_out(db, u)
    opps = db.query(Opportunity).filter(Opportunity.company_id == u.id, Opportunity.status == "open").all()
    out["open_opportunities"] = [opportunity_out(db, o) for o in opps]
    return out
