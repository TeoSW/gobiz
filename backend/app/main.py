import logging
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from . import graph
from .config import get_settings
from .db import SessionLocal, wait_for_db
from .llm.providers import ensure_model_pulled
from .matching.embeddings import embedder
from .routers import ai, applications, auth, companies, messages, meta, opportunities, students, university
from .seed import ensure_seeded

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")


@asynccontextmanager
async def lifespan(_app: FastAPI):
    settings = get_settings()
    wait_for_db()
    if settings.seed_demo_data:
        ensure_seeded()
    embedder.start_loading()  # background: the API is usable immediately with the hashing fallback
    ensure_model_pulled()  # background: rule-based extraction is used until the LLM is downloaded
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
for r in (auth, meta, ai, students, companies, opportunities, applications, messages, university):
    app.include_router(r.router)


# ---------------------------------------------------------------- built React app (one container serves UI + API)
STATIC = Path(get_settings().static_dir)
if (STATIC / "index.html").is_file():
    app.mount("/assets", StaticFiles(directory=STATIC / "assets"), name="assets")

    @app.get("/{path:path}", include_in_schema=False)
    def spa(path: str):
        if path.startswith("api/"):
            raise HTTPException(404, "Not found")
        file = (STATIC / path).resolve()
        if path and file.is_file() and STATIC.resolve() in file.parents:
            return FileResponse(file)  # favicon.svg and other public files
        return FileResponse(STATIC / "index.html")  # client-side routes (/explore, /university, ...)
