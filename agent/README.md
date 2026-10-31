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

## Typecheck

```bash
npm run typecheck
```
