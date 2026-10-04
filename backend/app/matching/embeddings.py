"""Text embeddings for the semantic component.

Primary: sentence-transformers `paraphrase-multilingual-MiniLM-L12-v2` (Apache-2.0, 384-d, Romanian + English),
loaded in a background thread so the API starts instantly. Until it is ready (or if it cannot be downloaded)
a hashed bag-of-words embedding is used. Skill aliases are canonicalised first, so "rapoarte vizuale" and
"dashboard" share a token even in the fallback.

The model accepts max 128 tokens, so texts are chunked and compared chunk-by-chunk.
"""

import hashlib
import logging
import math
import re
import threading
import unicodedata

from ..config import get_settings
from ..skills_catalog import find_skill_mentions

log = logging.getLogger(__name__)

HASH_DIM = 512
CHUNK_WORDS = 55  # ~ 100-120 multilingual sub-word tokens, under the model's 128 limit

_STOP = set(
    "the and for with that this from are our you your will have has into about their them who what which "
    "si sau cu de la in din pe pentru care este sunt avem vrem dorim un o al ale ai unei unui mai fi ca "
    "nu se sa să ne le lor cel cea".split()
)


def chunk_text(text: str, max_words: int = CHUNK_WORDS) -> list[str]:
    sentences = [s.strip() for s in re.split(r"(?<=[.!?;])\s+|\n+", text or "") if s.strip()]
    chunks, cur = [], []
    for sent in sentences:
        words = sent.split()
        while len(words) > max_words:  # hard-split very long sentences
            if cur:
                chunks.append(" ".join(cur))
                cur = []
            chunks.append(" ".join(words[:max_words]))
            words = words[max_words:]
        if len(cur) + len(words) > max_words and cur:
            chunks.append(" ".join(cur))
            cur = []
        cur += words
    if cur:
        chunks.append(" ".join(cur))
    return chunks


def _tokens(text: str) -> list[str]:
    plain = unicodedata.normalize("NFKD", text.lower())
    plain = "".join(ch for ch in plain if not unicodedata.combining(ch))
    toks = [t for t in re.findall(r"[a-z0-9+#]+", plain) if len(t) > 2 and t not in _STOP]
    toks = [t[:6] for t in toks]  # crude stemming: works for RO and EN inflections
    toks += [f"skill:{sid}" for sid, _ in find_skill_mentions(text)] * 2
    return toks


def hashing_embed(text: str) -> list[float]:
    vec = [0.0] * HASH_DIM
    for tok in _tokens(text):
        h = int(hashlib.md5(tok.encode()).hexdigest(), 16)
        vec[h % HASH_DIM] += 1.0 if (h >> 9) & 1 else -1.0
    norm = math.sqrt(sum(v * v for v in vec)) or 1.0
    return [v / norm for v in vec]


class Embedder:
    def __init__(self) -> None:
        s = get_settings()
        self.model_name = s.embeddings_model
        self.want_transformer = s.embeddings_backend == "sentence-transformers"
        self._model = None
        self.state = "disabled" if not self.want_transformer else "not_loaded"
        self.error: str | None = None
        self._lock = threading.Lock()

    @property
    def backend_id(self) -> str:
        return f"st:{self.model_name}" if self._model is not None else "hashing:v1"

    def start_loading(self) -> None:
        if not self.want_transformer or self.state in ("loading", "ready"):
            return
        self.state = "loading"
        threading.Thread(target=self._load, daemon=True, name="embedder-load").start()

    def _load(self) -> None:
        try:
            from sentence_transformers import SentenceTransformer

            model = SentenceTransformer(self.model_name, device="cpu")
            with self._lock:
                self._model = model
            self.state = "ready"
            log.info("Embedding model ready: %s", self.model_name)
        except Exception as exc:  # noqa: BLE001
            self.state = "failed"
            self.error = str(exc)[:300]
            log.warning("Embedding model unavailable, using hashing fallback: %s", exc)

    def encode(self, texts: list[str]) -> list[list[float]]:
        if not texts:
            return []
        with self._lock:
            model = self._model
        if model is not None:
            vecs = model.encode(texts, normalize_embeddings=True, convert_to_numpy=True)
            return [[round(float(x), 5) for x in v] for v in vecs]
        return [hashing_embed(t) for t in texts]

    def status(self) -> dict:
        return {"backend": self.backend_id, "state": self.state, "model": self.model_name, "error": self.error}


embedder = Embedder()


def text_key(text: str) -> str:
    return hashlib.sha1(f"{embedder.backend_id}|{text}".encode()).hexdigest()


def embed_cached(text: str, cache: dict | None) -> tuple[list[list[float]], dict | None]:
    """Return chunk vectors, reusing `cache` when text + backend are unchanged. Second value = new cache or None."""
    key = text_key(text)
    if cache and cache.get("key") == key:
        return cache["vectors"], None
    vectors = embedder.encode(chunk_text(text)) if text.strip() else []
    return vectors, {"key": key, "backend": embedder.backend_id, "vectors": vectors}


def chunk_similarity(a: list[list[float]], b: list[list[float]]) -> float | None:
    """Mean over chunks of `a` of the best cosine with any chunk of `b` (vectors are L2-normalised)."""
    if not a or not b:
        return None
    best = [max(sum(x * y for x, y in zip(va, vb)) for vb in b) for va in a]
    return sum(best) / len(best)
