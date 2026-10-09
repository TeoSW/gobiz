# SkillSync app image: the React frontend is built with Node, then served by the FastAPI backend.
# One container for UI + API; MySQL and Ollama run as their own official images (see docker-compose.yml).

# ---- 1. build the frontend ----
FROM node:20-alpine AS frontend
WORKDIR /frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY frontend/ ./
RUN npm run build

# ---- 2. backend + built frontend ----
FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    HF_HOME=/models \
    STATIC_DIR=/app/static

WORKDIR /app

COPY backend/requirements.txt .
# CPU-only PyTorch (~200 MB instead of ~2 GB with CUDA); embeddings are small and fast on CPU
RUN pip install torch --index-url https://download.pytorch.org/whl/cpu \
 && pip install -r requirements.txt

COPY backend/app ./app
COPY backend/scripts ./scripts
COPY backend/tests ./tests
COPY backend/pytest.ini .
COPY --from=frontend /frontend/dist ./static

EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
