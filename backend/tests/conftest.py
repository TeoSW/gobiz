import os
import sys
import tempfile
from pathlib import Path

# Deterministic, offline test environment: SQLite file, hashing embeddings, heuristic LLM, no graph.
_tmp = Path(tempfile.mkdtemp(prefix="skillsync-test-"))
os.environ.update(
    DATABASE_URL=f"sqlite:///{(_tmp / 'test.db').as_posix()}",
    EMBEDDINGS_BACKEND="hashing",
    LLM_PROVIDER="heuristic",
    NEO4J_URI="",
    UPLOAD_DIR=str(_tmp / "uploads"),
    STATIC_DIR=str(_tmp / "static"),
)
# a fake built frontend, so the single-container static serving is tested too
(_tmp / "static" / "assets").mkdir(parents=True)
(_tmp / "static" / "index.html").write_text("<!doctype html><title>SkillSync</title>", encoding="utf-8")
(_tmp / "static" / "assets" / "app.js").write_text("console.log('skillsync')", encoding="utf-8")
(_tmp / "static" / "favicon.svg").write_text("<svg/>", encoding="utf-8")
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402


@pytest.fixture(scope="session")
def client():
    from app.main import app
    from app.seed import reset_and_seed

    reset_and_seed()
    with TestClient(app) as c:
        yield c


@pytest.fixture(scope="session")
def personas(client):
    return {p["name"]: p["id"] for p in client.get("/api/personas").json()}


def as_user(user_id: int) -> dict:
    return {"X-User-Id": str(user_id)}


def new_opportunity(client, company_id: int) -> dict:
    """A fresh Power BI project, so a test does not depend on what other tests did to the demo data."""
    body = {
        "type": "project", "title": "Inventory dashboard test", "domain": "retail",
        "description": "Build an inventory dashboard in Power BI from our weekly Excel stock exports.",
        "tasks": ["Model the stock data", "Build the dashboard"], "hours_per_week": 8, "duration_weeks": 2,
        "compensation_type": "fixed", "compensation_amount": 1000,
        "requirements": [{"skill_id": "power_bi", "min_level": 2, "mandatory": True},
                         {"skill_id": "excel", "min_level": 1}],
    }
    r = client.post("/api/opportunities", json=body, headers=as_user(company_id))
    assert r.status_code == 201, r.text
    return r.json()
