# ipam-scan-agent (mock)

Mock scan agent for the IPAM app. It is a stand-in for the future multi-platform
agent (linux/windows/ios/android) that will scan real networks and report
discovered devices. For now it reports a fixed list of 6 mock devices.

## Requirements

- Node.js >= 23.6 (tested on Node 24). TypeScript is run natively via Node's
  type stripping, so no build step is needed.

## Setup

```bash
npm install
```

## Create an API key

Create a key either in the web UI (API Keys section) or via the API:

```bash
# login (seed user: admin/admin)
curl -s -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"admin\",\"password\":\"admin\"}"
# -> { "access_token": "..." }

# create a key
curl -s -X POST http://localhost:3000/api/v1/api-keys \
  -H "Authorization: Bearer <access_token>" \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"myagent\"}"
# -> { "key": "ipam-<32 random chars>", ... }  (shown only once)
```

## Run

```bash
npm run scan -- --api-key ipam-... --agent-name myagent
```

Full options:

```bash
npm run scan -- \
  --api-key ipam-... \
  --server http://localhost:3000 \
  --agent-name myagent \
  --platform linux \
  --interval 0
```

| Flag | Default | Description |
| --- | --- | --- |
| `--api-key <key>` | env `IPAM_API_KEY` | API key sent as `X-API-Key` header |
| `--server <url>` | `http://localhost:3000` | Backend base URL |
| `--agent-name <name>` | `mock-agent` | Agent name in the report |
| `--platform <platform>` | `linux` | Platform label (linux/windows/ios/android) |
| `--interval <seconds>` | `0` | `0` = run once and exit; `>0` = rescan every N seconds |

The agent POSTs `{ agent, platform, devices }` to `<server>/api/v1/scan/reports`
with the `X-API-Key` header and prints the JSON response
(`received`, `created`, `updated`, `reportId`). Exit code is `0` on success and
`1` on failure (an invalid API key prints a clear "invalid API key" message).

## WebSocket agent (connectors)

The WebSocket agent stays connected to the backend, sends a heartbeat every 30s
and runs connector commands sent by the backend (an assignment's schedule,
"Run now" on the Agents page, or "Scan now" in the top bar). It connects to the
backend directly, not through the Vite proxy.

```bash
npm run ws -- --api-key ipam-... --server ws://localhost:3000 --agent-name myagent --connector demo
```

| Flag | Default | Description |
| --- | --- | --- |
| `--api-key <key>` | env `IPAM_API_KEY` | API key sent in the `hello` message |
| `--server <url>` | `ws://localhost:3000` | Backend base URL (`http://` is turned into `ws://`) |
| `--agent-name <name>` | `mock-agent` | Agent name |
| `--platform <platform>` | `linux` | Platform label |
| `--connector <name>` | none | Connector to expose (repeatable): `mikrotik`, `demo` |

Connectors:

- `mikrotik`: reads a real RouterOS device through its API. Params:
  `{ host, port, username, password }`. Unreachable hosts fail with the
  connection error.
- `demo`: needs no params. After a 1-2 second pause it returns a handful of fake
  devices in the seeded subnets: four every time and a random half of seven
  others, three of which are not in the seed (`192.168.1.42`, `192.168.2.77`,
  `172.16.4.15` are created on first sight). Use it to see a successful scan end to
  end: create a connector of type `demo` with an empty config on the Connectors
  page, assign it to the agent on the Agents page, then click "Scan now".

## Typecheck

```bash
npm run typecheck
```
