import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from . import graph
from .config import get_settings
from .db import SessionLocal, wait_for_db
from .matching.embeddings import embedder
from .routers import ai, applications, companies, messages, meta, opportunities, students, university
from .seed import ensure_seeded

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")


@asynccontextmanager
async def lifespan(_app: FastAPI):
    settings = get_settings()
    wait_for_db()
    if settings.seed_demo_data:
        ensure_seeded()
    embedder.start_loading()  # background: the API is usable immediately with the hashing fallback
    with SessionLocal() as db:
        graph.safe_sync(db)
    yield


app = FastAPI(
    title="GoBiz API",
    description="Micro-projects, internships and jobs matching students with SMEs. Matching is a recommendation, not a decision.",
    version="0.1.0",
    lifespan=lifespan,
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in get_settings().cors_origins.split(",") if o.strip()],
    allow_methods=["*"],
    allow_headers=["*"],
)
for r in (meta, ai, students, companies, opportunities, applications, messages, university):
    app.include_router(r.router)
