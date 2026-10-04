from fastapi import APIRouter, Depends
from fastapi.concurrency import run_in_threadpool

from ..deps import require_role
from ..llm.extraction import extract_requirements
from ..models import User
from ..schemas import ExtractIn

router = APIRouter(prefix="/api/ai", tags=["ai"])


@router.post("/extract")
async def extract(body: ExtractIn, _user: User = Depends(require_role("company"))):
    """LLM reads the company's free text and proposes tasks + skills. The company confirms before publishing."""
    return await run_in_threadpool(extract_requirements, body.title, body.description, body.type)
