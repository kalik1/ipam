# IPAM

IPAM veloce: gestione di VLAN, subnet e device, con agenti di scansione che riportano i device trovati tramite API autenticata.

## Struttura

- `backend/` — API NestJS 11 + TypeORM, SQLite di default (Postgres con `DB_TYPE=postgres`). Porta 3000, base path `/api/v1`.
- `frontend/` — UI Vite + React 19 + Tailwind 4. Porta 5173, proxy `/api` verso il backend.
- `agent/` — agente di scansione mock (Node 24, zero dipendenze a runtime).
- `API.md` — contratto dell'API. `AGENTS.md` — note di sviluppo.

## Avvio rapido

Richiede Node 24. Un terminale per ciascun componente:

```bash
cd backend && npm install && npm run start:dev
cd frontend && npm install && npm run dev
cd agent && npm install && npm run scan -- --api-key ipam-... --agent-name myagent
```

Al primo avvio il backend crea il database con dati demo (login `admin`/`admin`) e stampa in console una API key di seed da passare all'agente. Altre key si creano dalla pagina API Keys della UI (`http://localhost:5173`).

Prima di esporre l'app imposta `JWT_SECRET` e cambia la password di `admin`.
