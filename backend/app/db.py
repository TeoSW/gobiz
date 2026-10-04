import logging
import time

from sqlalchemy import create_engine, text
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from .config import get_settings

log = logging.getLogger(__name__)


class Base(DeclarativeBase):
    pass


def _make_engine(url: str):
    if url.startswith("sqlite"):
        return create_engine(url, connect_args={"check_same_thread": False})
    return create_engine(url, pool_pre_ping=True, pool_recycle=1800)


engine = _make_engine(get_settings().database_url)
SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


def wait_for_db(retries: int = 30, delay_s: float = 2.0) -> None:
    """MySQL in Docker can take a while to accept connections; retry before giving up."""
    for attempt in range(1, retries + 1):
        try:
            with engine.connect() as conn:
                conn.execute(text("SELECT 1"))
            return
        except Exception as exc:  # noqa: BLE001 - any driver error means "not ready yet"
            log.warning("Database not ready (attempt %s/%s): %s", attempt, retries, exc)
            time.sleep(delay_s)
    raise RuntimeError("Database is not reachable")


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
