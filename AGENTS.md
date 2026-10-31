# AGENTS.md

## Project overview

IPAM (IP Address Management) local tool, composed of three subprojects plus a shared API contract:

- `backend/` — NestJS 11 + TypeORM + SQLite (default) or Postgres. Port 3000, base path `/api/v1`. Auth: JWT for the web UI (`POST /auth/login`), `X-API-Key` header for scan agents (`POST /scan/reports`).
- `frontend/` — Vite + React 19 + TypeScript + Tailwind 4. Port 5173, proxies `/api` to the backend.
- `agent/` — mock scan agent, plain Node 24 with native TypeScript type stripping (zero runtime deps). Stand-in for the future multi-platform agent (linux/windows/ios/android) that will scan real networks and report via the authenticated API.
- `API.md` — the API contract. It is the source of truth for routes, status codes, and JSON shapes. Read it before touching any of the three subprojects.

## Setup commands

```bash
# backend (port 3000)
cd backend && npm install && npm run start:dev

# frontend (port 5173, proxies /api -> :3000)
cd frontend && npm install && npm run dev

# agent (needs a running backend and an API key)
cd agent && npm install && npm run scan -- --api-key ipam-... --agent-name myagent
```

- The backend seeds automatically on first start (empty `backend/data/ipam.sqlite`): user `admin`/`admin`, demo VLANs/subnets/devices, and one API key named `seed` whose full value is printed once to the console.
- For a fresh re-seed: stop the backend and delete `backend/data/ipam.sqlite`.
- Node 24 is required (the agent relies on native TS type stripping: `node src/agent.ts`).
- To run several checkouts side by side: the backend honors `PORT`; the frontend dev server reads `IPAM_WEB_PORT` (default 5173) and `IPAM_API_TARGET` (proxy target, default `http://localhost:3000`).

## Build and test commands

| Subproject | Build | Test |
|---|---|---|
| `backend/` | `npm run build` | `npm test` (jest) |
| `frontend/` | `npm run build` (tsc -b && vite build) | `npm test` (vitest) |
| `agent/` | `npm run typecheck` | none (verified e2e manually) |

Run build and tests in every subproject you touch. All must pass before you are done.

## Code style

- TypeScript strict mode everywhere; no `any` unless unavoidable.
- No comments except for genuinely complex logic.
- No emojis in code or docs.
- Small, focused functions; follow the existing module layout (NestJS modules: controller + service + DTOs with class-validator).
- Backend date columns use `type: 'datetime'` (portable across sqlite and postgres; better-sqlite3 rejects `timestamp`).
- Frontend design system (network hardware look, dark and light themes): palette tokens are CSS variables on `<html class="dark|light">` in `frontend/src/index.css`, exposed to Tailwind as `ground`, `rail`, `panel`, `panel-hi`, `well`, `sunk`, `line`, `line-soft`, `fg`, `fg-2`, `fg-3`, `accent`, `accent-ink`, `led`, `led-off`, `pool`, `gw`, `warn`, `danger` (`bg-panel text-fg-2 border-line`). Style with these tokens; the `slate-*`/`indigo-*`/`red-*`/`emerald-*`/`amber-*`/`sky-*` utilities are remapped to tokens only as a temporary bridge for pages not yet rebuilt, delete the bridge once no page uses them.
- Frontend type: Archivo Variable for UI, Martian Mono Variable (`.mono`) for IPs, MACs and numbers, bundled from `@fontsource-variable/*/wdth.css` (no font CDN); condense with `font-stretch`, base 13px, sentence case.
- Frontend building blocks: reuse the base components in `frontend/src/components/` (`Button`, `Panel`/`PanelHeader`, `Selector`, `Table`, `FormField`, `Modal`, `ConfirmDialog`, `EmptyState`, `Badge`, `StatusLed`, `VlanChip`/`Cable`); page-level buttons go in the top bar through `<PageActions>`. Component CSS lives in `frontend/src/styles/`, one file per feature imported from `index.css`.
- VLAN cable colors come from `vlanColor(tag)` and `vlanLabel(vlan)` in `frontend/src/lib/vlan.ts`, keyed by the 802.1Q tag (`Vlan.vlanId`); `Subnet.vlanId` is the VLAN row id, so pass `subnet.vlan?.vlanId`.
- Frontend motion: every animation is triggered by a real backend event (scan report, command sent or result, agent ping, device created or offline) or lasts only while a real state is in progress (a command still `sent`). The shell and base components are static: hover and focus change color instantly, with a visible focus outline. See `docs/adr/0001-animations-driven-by-real-events.md`.

## Testing instructions

- Backend unit tests live next to the code (`*.spec.ts`): cidr lib, api-key lib, scan upsert. Add tests for the code you change, even if not asked.
- Frontend tests: `frontend/src/lib/*.test.ts` (vitest, node environment, `.test.ts` only). Keep logic in pure `.ts` modules and test it there; UI is verified by build + manual check.
- The cidr lib (`backend/src/lib/cidr.ts`) is dependency-free and pure — test edge cases: /24, /30, /31, /32, invalid inputs.
- Integration check (manual, when touching auth/scan/proxy): start backend + frontend, then verify through the Vite proxy (`http://localhost:5173/api/v1/...`): login returns a token, `GET /summary` with the token returns seeded data, `POST /scan/reports` with a valid `X-API-Key` upserts devices, invalid key returns 401.

## Security considerations

- API keys: only the sha256 hash is stored (`ApiKey.keyHash`); the full key is returned exactly once, at creation. Never log full keys except the single seed-time log.
- JWT secret comes from `JWT_SECRET` (default `dev-secret-change-me`); set a real value before exposing the app.
- The global `JwtAuthGuard` protects every route except those marked `@Public()` (`/auth/login`, `POST /scan/reports`). Keep that list minimal.
- The DB file `backend/data/ipam.sqlite` contains the demo credentials — treat it as local-only.

## Environment variables (backend)

| Var | Default | Purpose |
|---|---|---|
| `DB_TYPE` | `sqlite` | `sqlite` or `postgres` |
| `PG_HOST` / `PG_PORT` | `localhost` / `5432` | Postgres connection |
| `PG_USER` / `PG_PASS` / `PG_DB` | `postgres` / `''` / `ipam` | Postgres credentials |
| `JWT_SECRET` | `dev-secret-change-me` | JWT signing secret |

## Conventions

- The scan endpoint is the integration point for future real agents: keep `POST /scan/reports` backward compatible (agents identify with `X-API-Key`, report `{agent, platform, devices[]}`, devices are upserted by IP and auto-assigned to the subnet whose CIDR contains the IP).
- Devices not seen for 5 minutes are marked `offline` by the scheduler (`@Cron` every 60s).
- `API.md` and this file must stay in sync when routes or behaviors change.
- Git repo: https://github.com/kalik1/ipam (branch `main`). Commit or push only when asked.

## Agent skills

### Issue tracker

Issues live in GitHub Issues on `kalik1/ipam`, managed with the `gh` CLI. Wayfinder labels: `wayfinder:map`, `wayfinder:research`, `wayfinder:prototype`, `wayfinder:grilling`, `wayfinder:task`. See `docs/agents/issue-tracker.md`.

### Triage labels

Default vocabulary: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one `GLOSSARY.md` and `docs/adr/` at the repo root, created lazily by `/domain-modeling`. See `docs/agents/domain.md`.
