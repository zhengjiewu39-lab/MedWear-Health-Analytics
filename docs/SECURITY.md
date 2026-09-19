# MedWear API security & RBAC

MedWear defaults to **loopback** (`127.0.0.1`) for desktop/research use. Treat any bind to `0.0.0.0` as **trusted-network only**.

## Authentication

- JWT via `Authorization: Bearer <token>` after `POST /api/auth/login`.
- Demo accounts (`admin` / `demo`) only when `ALLOW_DEMO_AUTH` or non-production (see `docs/DESKTOP.md`).

## Role model

| Role | Purpose |
|------|---------|
| `admin` | Settings, security export, research recompute, AI intervention approve/generate |
| `viewer` | Read analytics, screening UI, import own Apple Health (demo user) |

## Route → role matrix (admin-only unless noted)

| Method | Path | Role |
|--------|------|------|
| GET | `/api/health`, `/api/auth/login` | Public |
| GET | `/api/*` (dashboard, screening, data status, …) | Authenticated |
| POST | `/api/data/import`, `/api/data/import/scan` | Authenticated |
| POST | `/api/research/wearable/evaluate` | **admin** |
| POST | `/api/research/evaluate`, `/api/research/analyze` | **admin** |
| POST | `/api/research/validate` | **admin** |
| POST | `/api/research/evaluation-supplement/regenerate` | **admin** |
| GET | `/api/research/*` (framework, results, validate GET, …) | Authenticated |
| GET | `/api/admin/*` | **admin** |
| POST | `/api/ai/interventions/generate` | **admin** |
| POST | `/api/ai/interventions/:id/approve` | **admin** |
| POST | `/api/ai/interventions/:id/reject` | **admin** |
| POST | `/api/settings/ai` | **admin** |
| POST | `/api/settings/thresholds` | **admin** |
| GET | `/api/settings` | Authenticated (thresholds read-only for non-admin) |
| GET | `/api/security/audit` | **admin** |
| GET | `/api/security/export` | **admin** |

Research POST routes also use **`researchComputeLimiter`** (rate limit).

## Runtime alert thresholds

- Defaults: `server/config/alertThresholds.js` (SpO₂ min **93%** for primary benchmark).
- Overrides: `runtime-settings.json` under the MedWear data directory via `POST /api/settings/thresholds` (admin).
- Engine reads thresholds through `loadRuntimeSettings()` → `getAllAnalytics(thresholds)`.
- **`npm run evaluate`** (primary manuscript metrics) ignores `runtime-settings.json`; see [EVALUATION.md](./EVALUATION.md).

## Verification

```bash
npm run test:server   # includes HTTP RBAC smoke tests (httpRbac.test.js)
```
