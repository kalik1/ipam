# IPAM Backend

NestJS 11 + TypeORM backend for the IPAM app. API base URL: `http://localhost:3000/api/v1` (see `../API.md` for the full contract).

## Run

```bash
npm install
npm run start:dev
```

- Server listens on `http://localhost:3000` (all routes under `/api/v1`).
- On first boot the database is created and **seeded automatically**: user `admin` / `admin`, 3 VLANs, 5 subnets, 12 devices (4 of them offline), and one API key named `seed`. The full seed API key is printed to the console once at seed time.
- Delete `data/ipam.sqlite` to re-seed from scratch.

## Tests

```bash
npm test
```

## Environment variables

| Variable     | Default                  | Description                                        |
| ------------ | ------------------------ | -------------------------------------------------- |
| `DB_TYPE`    | `sqlite`                 | `sqlite` or `postgres`                             |
| `PG_HOST`    | `localhost`              | Postgres host (only when `DB_TYPE=postgres`)      |
| `PG_PORT`    | `5432`                   | Postgres port                                      |
| `PG_USER`    | `postgres`               | Postgres user                                      |
| `PG_PASS`    | (empty)                  | Postgres password                                  |
| `PG_DB`      | `ipam`                   | Postgres database name                             |
| `JWT_SECRET` | `dev-secret-change-me`   | JWT signing secret — set a real value in prod     |
| `PORT`       | `3000`                   | HTTP port                                          |

SQLite file: `data/ipam.sqlite` (created automatically).

## Auth

- Web UI: `POST /api/v1/auth/login` with `{"username": "admin", "password": "admin"}` returns a JWT; send it as `Authorization: Bearer <token>` on all other endpoints.
- Agents: create a key via `POST /api/v1/api-keys` (the full `ipam-...` key is shown only in that response) and send it as the `X-API-Key` header on `POST /api/v1/scan/reports`.
