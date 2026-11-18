# Deploying FrauDex with Docker

The production image (`Dockerfile`) builds the React frontend and serves it
from the FastAPI backend, so the whole app is one container on one port:

- website: `http://<host>:8080/`
- API: `http://<host>:8080/api/...`
- health check: `http://<host>:8080/health`

`docker-compose.prod.yml` runs that container with PostgreSQL.

## Run it (any machine with Docker)

```bash
cp .env.prod.example .env.prod      # then change every password/secret in it
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build
```

Open http://localhost:8080 and log in with `ADMIN_EMAIL` / `ADMIN_PASSWORD`
from `.env.prod`.

On first start the app:

- loads the built-in policy knowledge base;
- creates the admin account if it does not exist (it never resets a password
  changed in the app);
- with `SEED_DEMO_DATA=true`, fills an empty database with about 1,000 demo
  invoices. Press **Check all** on the Invoices page to fraud-check them.

Useful commands:

```bash
docker compose -f docker-compose.prod.yml --env-file .env.prod logs -f app   # logs
docker compose -f docker-compose.prod.yml --env-file .env.prod down          # stop (data kept)
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build # update after git pull
```

The database and uploaded invoices live in the Docker volumes `db_data` and
`uploads`. `down -v` deletes them.

## Put it on the internet

**A server (VPS):** install Docker, clone the repo, and run the commands above.
Open port 8080, or put a reverse proxy with HTTPS (Caddy, Nginx) in front of it.

**Render (free tier):** `render.yaml` is a Render Blueprint that builds the same
Dockerfile and creates the PostgreSQL database.

1. Go to dashboard.render.com, then New → Blueprint, and pick this GitHub repo.
2. Fill in `ADMIN_EMAIL`, `ADMIN_PASSWORD` and, optionally, `GEMINI_API_KEY`
   when Render asks.
3. Deploy. The site URL appears on the `fraudex` service.

Free-tier limits: the service sleeps after 15 minutes idle (the first visit then
takes about a minute), the free database expires after 30 days, and uploaded
files are lost on redeploy.

## AI explanations

- There is no Ollama in the cloud. Without an LLM the app still scores
  invoices (rules and the trained model) and writes a summary that cites the
  policies.
- For AI-written explanations, set `GEMINI_API_KEY` (a free key from Google AI
  Studio).
- On a machine that runs Ollama, the compose file points the app at the host's
  Ollama (`host.docker.internal:11434`); set `RAG_EMBEDDER=auto` to also use
  its embeddings.
