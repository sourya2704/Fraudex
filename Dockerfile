# Production image: the React build served by the FastAPI backend (app.serve).
# Local development uses docker-compose.yml / the dev servers instead.

# 1. Build the frontend; the API lives under /api on the same origin.
FROM node:20-slim AS frontend
WORKDIR /frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN VITE_API_URL=/api npm run build

# 2. Backend with OCR (tesseract) for scanned invoices.
FROM python:3.13-slim
ENV PYTHONUNBUFFERED=1 PIP_NO_CACHE_DIR=1
RUN apt-get update \
    && apt-get install -y --no-install-recommends tesseract-ocr \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY backend/requirements.txt .
RUN pip install -r requirements.txt
COPY backend/ ./
COPY --from=frontend /frontend/dist ./static
RUN mkdir -p storage/invoices

# Hosts such as Render pass the port in $PORT.
CMD ["sh", "-c", "uvicorn app.serve:app --host 0.0.0.0 --port ${PORT:-8000}"]
