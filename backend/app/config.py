from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


BACKEND_DIR = Path(__file__).resolve().parents[1]


class Settings(BaseSettings):
    """Runtime configuration. Every value can be overridden with an env var of the same name."""

    model_config = SettingsConfigDict(env_file=(BACKEND_DIR / ".env", ".env"), env_file_encoding="utf-8", extra="ignore")

    app_name: str = "GoBiz API"
    # MySQL in Docker; SQLite is the zero-setup fallback for local dev and tests.
    database_url: str = f"sqlite:///{(BACKEND_DIR / 'gobiz.db').as_posix()}"
    seed_demo_data: bool = True
    upload_dir: str = str(BACKEND_DIR / "uploads")
    cors_origins: str = "http://localhost:5173,http://localhost:8080"
    # Built React app (frontend/dist). In Docker it is copied here and served by FastAPI itself (no nginx container).
    static_dir: str = str(BACKEND_DIR / "static")

    # --- LLM (requirement extraction) -------------------------------------------------
    # "ollama" (default, falls back to heuristic automatically) or "heuristic".
    llm_provider: str = "ollama"
    ollama_url: str = "http://127.0.0.1:11434"  # 127.0.0.1, not localhost: avoids a slow IPv6 attempt on Windows
    # Qwen3 1.7B (Apache-2.0, ~1.4 GB) runs fully on a 4 GB GPU (GTX 1050 Ti: ~34 tokens/s, extraction ~10-15 s).
    # qwen3:4b gives better extraction but needs ~6 GB VRAM to avoid spilling into system RAM.
    ollama_model: str = "qwen3:1.7b"
    ollama_timeout_s: float = 120.0
    ollama_num_ctx: int = 3072  # prompt ~450 tokens + answer <= 900
    # download the model through the Ollama API on startup if missing (replaces a separate "pull" container)
    ollama_auto_pull: bool = True

    # --- Embeddings ---------------------------------------------------------------------
    # "sentence-transformers" (falls back to hashing while loading / if unavailable) or "hashing".
    embeddings_backend: str = "sentence-transformers"
    embeddings_model: str = "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2"

    # --- Matching weights (design discussion defaults) ------------------------------------
    w_skills: float = 0.50
    w_experience: float = 0.25
    w_interests: float = 0.15
    w_semantic: float = 0.10

    # --- Optional knowledge graph -------------------------------------------------------------
    neo4j_uri: str = ""
    neo4j_user: str = "neo4j"
    neo4j_password: str = "gobiz-graph"


@lru_cache
def get_settings() -> Settings:
    return Settings()
