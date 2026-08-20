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

GitHub Actions (`.github/workflows/ci.yml`) runs on **push** and **pull_request** to `main` / `master`.

### Job: `test-and-evaluate`

Node 22 · Ubuntu latest:

1. `npm ci`
2. `npm run docs:verify` — METHODS EN/ZH parity with `methodologyTransparency.js`
3. `npm run test:server`
4. `npm audit --audit-level=high` (informational; `continue-on-error: true`)
5. `npm run evaluate`
6. Python 3.11 → `pip install -r experiments/medwear/requirements-min.txt`
7. `npm run evaluate:supplement` — scenarios, FP burden, ML compare, EVALUATION sync
8. `npm run build`

### Job: `docker`

Runs after `test-and-evaluate` passes:

```bash
docker build -t medwear-api .
```

## Version Pinning

- Node.js **22** in CI; **18+** recommended locally · lockfile: `package-lock.json`
- Python **3.11** in CI; **3.9+** locally
- Pinned Python stacks (reproducible installs):
  - `experiments/medwear/requirements-min.txt` — CI supplement / fair ML compare
  - `scripts/benchmark_requirements.txt` — `npm run benchmark:system`
  - `notebooks/requirements.txt` — `npm run notebook:reproduction`
