# Reproducibility Guide

## One-Command Setup

```bash
git clone <your-repo-url>
cd medwear-health-analytics
npm install
npm run test:server
npm run evaluate
npm run dev
```

## Docker

```bash
docker compose up --build
```

- 应用（前后端一体）: http://localhost:3001
- 数据目录挂载: `./data`

## Desktop / portable

See [docs/DESKTOP.md](DESKTOP.md) for `npm run app` and zip packaging.

## Environment

Copy `.env.example` → `.env`:

| Variable | Purpose |
|----------|---------|
| `PORT` | API port (default 3001) |
| `OPENAI_API_KEY` | Real-mode LLM (optional) |
| `MEDWEAR_JWT_SECRET` | Auth token signing |

## Verify Pipeline

```bash
curl http://localhost:3001/api/health
curl http://localhost:3001/api/research/methods
curl -X POST http://localhost:3001/api/research/evaluate
```

## Sample Data

Benchmark uses synthetic JSON — no PHI required.

For real-mode demo: export Apple Health zip from iPhone → upload at `/import`.

## CI

GitHub Actions runs on push:

1. `npm run test:server`
2. `npm run evaluate`
3. `npm run build`

## Version Pinning

- Node.js 18+ recommended
- Lockfile: `package-lock.json`
