import os
import sys
import tempfile
from pathlib import Path

# Deterministic, offline test environment: SQLite file, hashing embeddings, heuristic LLM, no graph.
_tmp = Path(tempfile.mkdtemp(prefix="gobiz-test-"))
os.environ.update(
    DATABASE_URL=f"sqlite:///{(_tmp / 'test.db').as_posix()}",
    EMBEDDINGS_BACKEND="hashing",
    LLM_PROVIDER="heuristic",
    NEO4J_URI="",
    UPLOAD_DIR=str(_tmp / "uploads"),
)
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
