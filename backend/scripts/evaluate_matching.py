"""Offline evaluation of the matching engine against manually labelled relevant students.

Compares three rankers on scripts/eval_dataset.py, as recommended in the design discussion:
  * full      - hard filters + 50/25/15/10 score (what the product uses)
  * skills    - same filters, skills component only (baseline)
  * semantic  - embeddings similarity only (baseline)

Metrics: precision@5, recall@5, MRR. Run:
    python -m scripts.evaluate_matching              # hashing embeddings (fast, offline)
    EMBEDDINGS_BACKEND=sentence-transformers python -m scripts.evaluate_matching   # real model
"""

import json
import os
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
os.environ.setdefault("DATABASE_URL", f"sqlite:///{(Path(tempfile.mkdtemp()) / 'eval.db').as_posix()}")
os.environ.setdefault("EMBEDDINGS_BACKEND", "hashing")
os.environ["NEO4J_URI"] = ""

from app.db import SessionLocal  # noqa: E402
from app.matching.embeddings import chunk_similarity, embedder  # noqa: E402
from app.matching.engine import Weights, rank_key  # noqa: E402
from app.matching.service import match_pair, opportunity_vectors, student_vectors  # noqa: E402
from app.models import Opportunity, StudentProfile, User  # noqa: E402
from app.seed import reset_and_seed  # noqa: E402
from scripts.eval_dataset import EVAL_DATA, OPPORTUNITIES  # noqa: E402

K = 5


def metrics(ranked: list[int], relevant: set[int]) -> tuple[float, float, float]:
    top = ranked[:K]
    hits = sum(s in relevant for s in top)
    rr = next((1 / (i + 1) for i, s in enumerate(ranked) if s in relevant), 0.0)
    return hits / K, hits / len(relevant), rr


def main() -> None:
    reset_and_seed(EVAL_DATA)  # 14 students, 8 companies (the app demo has only 2 + 2)
    if embedder.want_transformer:
        print("Loading embedding model ...")
        embedder._load()  # synchronous for the script
    print(f"Embeddings backend: {embedder.backend_id}\n")

    labels = json.loads((Path(__file__).parent / "eval_labels.json").read_text(encoding="utf-8"))
    titles = {o["key"]: o["title"] for o in OPPORTUNITIES}
    totals = {"full": [0.0, 0.0, 0.0], "skills": [0.0, 0.0, 0.0], "semantic": [0.0, 0.0, 0.0]}
    skills_only = Weights(1.0, 0.0, 0.0, 0.0)

    with SessionLocal() as db:
        students = db.query(StudentProfile).all()
        key_to_id = {u.email.split("@")[0]: u.id for u in db.query(User).filter(User.role == "student")}
        print(f"{'opportunity':<46} {'full P@5':>8} {'skills':>7} {'sem':>6}")
        for key, rel_keys in labels.items():
            o = db.query(Opportunity).filter(Opportunity.title == titles[key]).one()
            relevant = {key_to_id[k] for k in rel_keys}
            full = sorted((match_pair(db, p, o) for p in students), key=rank_key)
            sk = sorted((match_pair(db, p, o, skills_only) for p in students), key=rank_key)
            o_vec = opportunity_vectors(db, o)
            sem = sorted(students, key=lambda p: -(chunk_similarity(o_vec, student_vectors(db, p)) or 0))
            rows = {
                "full": metrics([r["student_id"] for r in full], relevant),
                "skills": metrics([r["student_id"] for r in sk], relevant),
                "semantic": metrics([p.user_id for p in sem], relevant),
            }
            for name, vals in rows.items():
                totals[name] = [a + b for a, b in zip(totals[name], vals)]
            print(f"{o.title[:45]:<46} {rows['full'][0]:>8.2f} {rows['skills'][0]:>7.2f} {rows['semantic'][0]:>6.2f}")

    n = len(labels)
    print(f"\n{'ranker':<10} {'P@5':>6} {'R@5':>6} {'MRR':>6}")
    for name, (p, r, m) in totals.items():
        print(f"{name:<10} {p / n:>6.3f} {r / n:>6.3f} {m / n:>6.3f}")
    print("\nNote: P@5 is capped when an opportunity has fewer than 5 relevant students; compare rankers, not absolutes.")


if __name__ == "__main__":
    main()
