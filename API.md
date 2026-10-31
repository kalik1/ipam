# IPAM API Contract

Base URL: `http://localhost:3000/api/v1`

Tutti gli endpoint restituiscono JSON. Errori: `{ "message": string, "statusCode": number }`.

## Auth

Tre meccanismi:
1. **Web UI**: `Authorization: Bearer <JWT>` (ottenuto da `/auth/login`). Richiesto su TUTTI gli endpoint tranne `/auth/login` e `/scan/reports` (POST).
2. **Agenti**: header `X-API-Key: <key>` sul POST `/scan/reports`.
3. **Agenti WebSocket**: campo `apiKey` nel messaggio `hello` su `ws://<host>:3000/ws/agent` (stesse key di `X-API-Key`).

### POST /auth/login
Body: `{ "username": string, "password": string }`
- 200: `{ "access_token": string, "user": { "id": number, "username": string } }`
- 401: credenziali errate

## VLANs

### GET /vlans
- Query: `search` (match name/description, case-insensitive)
- 200: `Vlan[]`

### GET /vlans/:id
- `:id` = chiave primaria `id` (non `vlanId`)
- 200: `VlanDetail`
- 404: non trovata

`VlanDetail`: campi di `Vlan` + `subnets: Subnet[]` (come in `GET /subnets`, include `deviceCount`, `totalHosts`, `usedHosts`) + `deviceCount: number` (totale device di tutte le subnet del VLAN).

### POST /vlans
Body: `{ "vlanId": number (1-4094), "name": string, "description"?: string }`
- 201: `Vlan`
- 400: vlanId non valido
- 409: vlanId già esistente

### PUT /vlans/:vlanId
Body: `{ "name"?: string, "description"?: string }` (vlanId non modificabile)
- 200: `Vlan`
- 404: non trovata

### DELETE /vlans/:vlanId
- 200
- 404: non trovata
- 409: se ci sono subnet collegate

`Vlan`: `{ "id": number, "vlanId": number, "name": string, "description": string, "createdAt": string, "updatedAt": string }`

## Subnets

### GET /subnets
- Query: `vlanId` (number), `search` (match name/cidr)
- 200: `Subnet[]` (include `vlan?: Vlan` e `deviceCount: number`)

### GET /subnets/:id
- `:id` = chiave primaria `id`
- 200: `SubnetDetail`
- 404: non trovata

`SubnetDetail`: campi di `Subnet` + `devices: Device[]` (tutti i device della subnet).

### POST /subnets
Body: `{ "cidr": string (es. "192.168.1.0/24"), "name": string, "gateways"?: string[] (IP nella subnet), "includeFirstLast"?: boolean (default false), "dhcpPools"?: DhcpPoolBody[], "vlanId"?: number (esistente), "description"?: string, "domainName"?: string, "dnsServers"?: string (IP separati da virgola), "ntpServers"?: string (server separati da virgola) }`
- 201: `Subnet`
- 400: CIDR non valido, gateway non nella subnet, gateway non in range utilizzabile (se `includeFirstLast` = false), gateway duplicato, pool DHCP non valido
- 409: CIDR già esistente

### PUT /subnets/:id
Body: `{ "cidr"?: string, "name"?: string, "gateways"?: string[], "includeFirstLast"?: boolean, "dhcpPools"?: DhcpPoolBody[], "vlanId"?: number, "description"?: string, "domainName"?: string, "dnsServers"?: string, "ntpServers"?: string }`
- `gateways` e `dhcpPools`, se forniti, sostituiscono l'elenco completo
- 200: `Subnet`
- 400: se `cidr` non valida, gateway non nella subnet, gateway fuori range utilizzabile (se `includeFirstLast` = false), gateway duplicato, o pool DHCP non valido
- 404: non trovata
- 409: se `cidr` già esistente

### DELETE /subnets/:id
- 200
- 404: non trovata
- 409: se ci sono device collegati

`Subnet`: `{ "id": number, "cidr": string, "name": string, "gateways": string[] (ordinati numericamente), "includeFirstLast": boolean, "dhcpPools": DhcpPool[], "vlanId": number, "vlan": Vlan, "description": string, "domainName": string, "dnsServers": string (IP separati da virgola, es. "1.1.1.1, 8.8.8.8"), "ntpServers": string (server separati da virgola), "deviceCount": number, "totalHosts": number, "usedHosts": number, "createdAt": string, "updatedAt": string }`
- `totalHosts` con `includeFirstLast` = false (default): host utilizzabili nel CIDR (esclusi network/broadcast; per /31 e /32 = 0)
- `totalHosts` con `includeFirstLast` = true: tutti gli indirizzi del CIDR (per /31 = 2, per /32 = 1)
- `usedHosts` = numero di device nella subnet

## DHCP Pools

### GET /subnets/:id/dhcp-pools
- 200: `DhcpPool[]`
- 404: subnet non trovata

### POST /subnets/:id/dhcp-pools
Body: `{ "name"?: string, "startIp": string, "endIp": string }`
- 201: `DhcpPool`
- 400: IP non validi, pool fuori dalla subnet, `startIp` > `endIp`, pool fuori dal range utilizzabile (se `includeFirstLast` = false)
- 404: subnet non trovata
- I pool sovrapposti sono ammessi

### PUT /dhcp-pools/:id
Body: `{ "name"?: string, "startIp"?: string, "endIp"?: string }` (i campi forniti sostituiscono i valori esistenti)
- 200: `DhcpPool`
- 400: stessa validazione di POST
- 404: pool non trovato

### DELETE /dhcp-pools/:id
- 200
- 404: pool non trovato

`DhcpPool`: `{ "id": number, "name": string, "startIp": string, "endIp": string }`

## Devices

### GET /devices
- Query: `subnetId` (number), `status` (`online` | `offline`), `search` (match ip/hostname/mac)
- 200: `Device[]` (include `subnet?: Subnet`)

### POST /devices
Body: `{ "ip": string, "mac"?: string, "hostname"?: string, "vendor"?: string, "subnetId"?: number, "notes"?: string }`
- 201: `Device`
- 400: IP non valido, o `subnetId` inesistente
- 409: IP già esistente

### PUT /devices/:id
Body: `{ "ip"?: string, "mac"?: string, "hostname"?: string, "vendor"?: string, "subnetId"?: number, "notes"?: string }`
- 200: `Device`
- 400: IP non valido, o `subnetId` inesistente
- 404: non trovato
- 409: IP già esistente

### DELETE /devices/:id
- 200

`Device`: `{ "id": number, "ip": string, "mac": string, "hostname": string, "vendor": string, "subnetId": number, "subnet": Subnet, "status": "online" | "offline", "lastSeen": string, "notes": string, "createdAt": string, "updatedAt": string }`

## API Keys (per agenti)

### GET /api-keys
- 200: `ApiKey[]`

### POST /api-keys
Body: `{ "name": string }`
- 201: `{ "id": number, "name": string, "key": string (MOSTRATA SOLO ADESSO, in DB solo l'hash), "keyPrefix": string (prime 8 caratteri), "createdAt": string, "lastUsedAt": string | null }`
- La key ha formato `ipam-<32 caratteri random>`.

### DELETE /api-keys/:id
- 200

`ApiKey`: `{ "id": number, "name": string, "keyPrefix": string, "createdAt": string, "lastUsedAt": string | null }` (il campo `key` solo nella risposta di creazione)

## Scan (endpoint per agenti)

### POST /scan/reports
Header: `X-API-Key: <key>`
Body:
```json
{
  "agent": "nome-agente (string, max 100)",
  "platform": "string opzionale (es. linux, windows, ios, android)",
  "devices": [
    { "ip": "192.168.1.10", "mac": "AA:BB:CC:DD:EE:FF", "hostname": "router", "vendor": "Cisco" }
  ]
}
```
- 201: `{ "received": number, "created": number, "updated": number, "reportId": number }`
- 401: key assente o non valida
- Comportamento: per ogni device nel body, upsert per IP (crea se nuovo, aggiorna mac/hostname/vendor/lastSeen se esistente). `status` diventa `online`. Se `subnetId` non è specificato nel body del device, il server cerca la subnet il cui CIDR contiene l'IP e la associa (o `null` se nessuna).

### GET /scan/reports
- Query: `limit` (default 50, max 200)
- 200: `ScanReport[]`

`ScanReport`: `{ "id": number, "agent": string, "platform": string, "deviceCount": number, "receivedAt": string }` (platform = `""` se non fornito)

## Agents (control plane)

Gli agenti restano collegati al backend via WebSocket (vedi "WebSocket protocol" qui sotto) e le sessioni sono tracciate in memoria: l'elenco restituisce solo gli agenti connessi in questo momento.

I comandi `run_connector` passano al connector i `params` forniti nel body del comando: la configurazione del connector (host, credenziali, ecc.) è fornita dal chiamante al momento del comando, non dall'agente.

### GET /agents
- 200: `Agent[]` (solo agenti connessi)

`Agent`: `{ "name": string, "platform": string, "connectors": string[], "connectedAt": string, "lastPingAt": string }`

### POST /agents/:name/commands
Body: `{ "action": "run_connector", "connector": string (non vuoto), "params"?: object }`
- 201: `{ "id": string (uuid del comando, da usare per leggere il risultato) }`
- 400: `action` non valida (solo `run_connector`) o `connector` mancante
- 404: agente non connesso

### GET /agents/:name/results
- 200: `AgentResult` (ultimo risultato ricevuto dall'agente)
- 404: agente senza risultati

`AgentResult`: `{ "id": string, "ok": boolean, "data"?: object (solo se `ok` = true), "error"?: string (solo se `ok` = false), "receivedAt": string }`

## Connectors

Un `Connector` definisce un tipo di dispositivo interrogabile (es. `mikrotik`) e la sua configurazione (host, porta, credenziali). Un'assegnazione collega un connector a un agente con una schedula cron a 5 campi: lo scheduler del backend (ogni 30s) invia il comando `run_connector` all'agente quando la schedula scade. Se l'agente non è connesso, l'esecuzione viene contrassegnata come `skipped`. I comandi inviati restano `sent` finché l'agente non risponde; a quel punto lo scheduler risolve lo stato finale (`ok` / `error`).

### GET /connectors
- 200: `Connector[]`

### POST /connectors
Body: `{ "name": string (non vuoto, es. "mikrotik"), "label"?: string, "config": object (es. { "host": "192.168.1.1", "port": 8728, "username": "admin", "password": "..." }) }`
- 201: `Connector`
- 400: `config` non è un oggetto

### PUT /connectors/:id
Body: `{ "name"?: string, "label"?: string, "config"?: object }` (i campi forniti sostituiscono i valori esistenti)
- 200: `Connector`
- 404: non trovato

### DELETE /connectors/:id
- 204
- 404: non trovato
- Le assegnazioni collegate vengono rimosse (cascade)

### GET /agents/:name/connectors
- 200: `Assignment[]` (solo le assegnazioni dell'agente indicato, con `connector` incluso)

### POST /agents/:name/connectors
Body: `{ "connectorId": number (esistente), "schedule": string (cron 5 campi, es. "*/5 * * * *"), "enabled"?: boolean (default true) }`
- 201: `Assignment` (con `nextRunAt` calcolato dalla schedula)
- 400: `schedule` non valida
- 404: connector non trovato
- 409: assegnazione già esistente per quell'agente
- L'assegnazione funziona indipendentemente dalla connessione dell'agente

### PUT /agents/:name/connectors/:connectorId
Body: `{ "schedule"?: string, "enabled"?: boolean }`
- 200: `Assignment` (se `schedule` cambia, `nextRunAt` viene ricalcolato)
- 400: `schedule` non valida
- 404: assegnazione non trovata

### DELETE /agents/:name/connectors/:connectorId
- 204
- 404: assegnazione non trovata

### POST /agents/:name/connectors/:connectorId/move
Body: `{ "toAgent": string (non vuoto) }`
- 201: `Assignment` (con `nextRunAt` ricalcolato)
- 404: assegnazione non trovata per l'agente indicato
- 409: l'agente di destinazione ha già quel connector

### POST /agents/:name/connectors/:connectorId/run
- 200: `{ "id": string }` (id del comando inviato all'agente; `lastStatus` diventa `sent`)
- 404: assegnazione non trovata, oppure agente non connesso

`Connector`: `{ "id": number, "name": string, "label": string, "config": object, "createdAt": string, "updatedAt": string }`

`Assignment`: `{ "id": number, "agentName": string, "connectorId": number, "connector": Connector, "schedule": string, "enabled": boolean, "lastRunAt": string | null, "lastStatus": "ok" | "error" | "skipped" | "sent" | null, "lastError": string | null, "nextRunAt": string | null, "commandRef": string | null }`

## WebSocket protocol

Endpoint: `ws://<host>:3000/ws/agent`. Messaggi JSON, uno per frame.

Autenticazione: l'agente si autentica nel messaggio `hello` con una API key valida (le stesse key usate con `X-API-Key`, create via `POST /api-keys`).

### Handshake

agent -> server:
```json
{
  "type": "hello",
  "agent": "nome (string, max 100)",
  "platform": "string (es. linux)",
  "apiKey": "ipam-...",
  "connectors": ["mikrotik"]
}
```

server -> agent:
```json
{ "type": "hello_ack", "ok": true }
```
oppure, se la key non è valida:
```json
{ "type": "hello_ack", "ok": false, "error": "invalid_api_key" }
```
seguito da chiusura della connessione. Se un altro socket si collega con lo stesso nome agente, la sessione precedente viene chiusa.

### Ping/pong

- L'agente invia `{"type":"ping"}` ogni 30s; il server risponde `{"type":"pong"}`.
- Il server chiude la connessione se non riceve ping per 90s (watchdog).

### Comandi

server -> agent:
```json
{
  "type": "command",
  "id": "uuid",
  "action": "run_connector",
  "connector": "mikrotik",
  "params": { "host": "192.168.1.1", "port": 8728, "username": "admin", "password": "secret" }
}
```
`params` è opzionale e viene passato al connector così com'è.

### Risultati

agent -> server:
```json
{
  "type": "result",
  "id": "uuid (stesso del comando)",
  "ok": true,
  "data": {
    "connector": "mikrotik",
    "devices": [
      { "ip": "192.168.1.10", "mac": "AA:BB:CC:DD:EE:FF", "hostname": "router", "vendor": "MikroTik" }
    ]
  }
}
```
oppure
```json
{ "type": "result", "id": "uuid", "ok": false, "error": "string" }
```
Il server memorizza l'ultimo risultato per agente (letto via `GET /agents/:name/results`). Se `data.devices` è un array di device validi, vengono upsertati come in `POST /scan/reports`.

Se `data` contiene sezioni di rete, il server le importa automaticamente (upsert non distruttivo):
- `data.vlans`: `[{ "vlanId": number (0-4095), "name": string }]` → crea i VLAN mancanti (per `vlanId`), non sovrascrive i nomi esistenti.
- `data.subnets`: `[{ "cidr": string, "name": string, "gateway"?: string, "vlanId"?: number, "domainName"?: string, "dnsServers"?: string[], "ntpServers"?: string[] }]` → crea le subnet mancanti (per CIDR) con gateway e VLAN; sulle subnet esistenti collega il VLAN mancante, aggiunge gateway mancanti e compila i campi vuoti `domainName`/`dnsServers`/`ntpServers` (le liste vengono salvate come stringhe separate da virgola).
- `data.reservedIps`: `[{ "ip": string, "mac"?: string, "hostname"?: string }]` → i device mancanti vengono creati come `offline` e collegati alla subnet che contiene l'IP; i device esistenti ricevono `mac`/`hostname` se mancanti (lo stato `online` non viene mai toccato).
- `data.dhcpRanges`: `[{ "name": string, "startIp": string, "endIp": string }]` → pool DHCP aggiunti alla subnet che contiene il range (aggiorna un pool esistente con lo stesso nome o lo stesso range).

### Report (opzionale)

agent -> server:
```json
{
  "type": "report",
  "platform": "string",
  "devices": [
    { "ip": "string", "mac"?: "string", "hostname"?: "string", "vendor"?: "string" }
  ]
}
```
server -> agent: `{ "type": "report_ack", "received": number, "created": number, "updated": number, "reportId": number }` — stesso comportamento di `POST /scan/reports`.

### Errori

Per messaggi non validi il server risponde `{"type":"error","message":"<codice>"}` e, a seconda del codice, può chiudere la connessione. Codici: `invalid_json`, `invalid_message`, `missing_type`, `unknown_type`, `invalid_agent`, `invalid_platform`, `invalid_api_key`, `invalid_connectors`, `invalid_devices`, `invalid_device`, `invalid_id`, `invalid_ok`, `invalid_data`, `invalid_error`, `not_authenticated`.

## Live events

### GET /events
Header: `Authorization: Bearer <JWT>` (il token va solo nell'header, mai nell'URL; il frontend legge lo stream con `fetch`).
- 200: stream `text/event-stream` (server-sent events) che resta aperto
- 401: token assente o non valido

Ogni evento è un messaggio SSE con `event: <tipo>`, un `id:` progressivo per connessione e una riga `data:` con il payload JSON:
```
event: agent.heartbeat
id: 3
data: {"agent":"hq-scanner","at":"2026-10-31T10:00:00.000Z"}

```
- Keepalive: ogni 15s il server invia il commento `: keepalive`. I commenti non sono eventi.
- Nessun replay: un client riceve solo gli eventi pubblicati mentre è connesso (`Last-Event-ID` non è supportato). Dopo una riconnessione rileggere lo stato via REST (es. `GET /agents`).
- I client devono ignorare i tipi di evento che non conoscono.

| `event` | `data` | Quando |
|---|---|---|
| `agent.connected` | `{ "agent": string, "platform": string }` | `hello` valido sul WebSocket, anche quando sostituisce la sessione di un agente con lo stesso nome |
| `agent.heartbeat` | `{ "agent": string, "at": string (ISO 8601) }` | ogni `ping` di un agente autenticato |
| `agent.disconnected` | `{ "agent": string }` | chiusura del socket di una sessione attiva, oppure watchdog (nessun ping per 90s); non emesso quando un nuovo `hello` con lo stesso nome sostituisce la sessione |

## Summary

### GET /summary
- 200:
```json
{
  "vlans": 3,
  "subnets": 5,
  "devices": 42,
  "devicesOnline": 30,
  "devicesOffline": 12,
  "subnetsUtilization": [
    { "id": 1, "name": "LAN", "cidr": "192.168.1.0/24", "used": 42, "total": 254, "percent": 16.5 }
  ]
}
```

## Topology

### GET /topology
- 200:
```json
{
  "vlans": [
    {
      "id": 1,
      "vlanId": 10,
      "name": "LAN",
      "description": "",
      "subnets": [
        {
          "id": 1,
          "cidr": "192.168.1.0/24",
          "name": "LAN",
          "gateways": ["192.168.1.1", "192.168.1.2"],
          "used": 42,
          "total": 254,
          "percent": 16.5,
          "devices": [
            { "id": 1, "ip": "192.168.1.10", "hostname": "router", "status": "online", "lastSeen": "2025-01-01T00:00:00Z" }
          ]
        }
      ]
    }
  ]
}
```
- Le subnet senza VLAN sono raggruppate in una pseudo-voce `{ "id": null, "vlanId": null, "name": "Unassigned", "description": "" }`, inclusa solo se esistono subnet senza VLAN.
- `percent` = `used`/`total` arrotondato a 1 decimale (0 se `total` = 0).
- I device senza subnet non compaiono nella topologia.

## Task schedulato
Ogni 60s: device con `lastSeen` > 5 minuti fa → `status = "offline"`.
Ogni 30s: per ogni assegnazione di connector abilitata, se `nextRunAt` è scaduto invio del comando `run_connector` all'agente (`lastStatus` = `sent`; `skipped` se l'agente non è connesso) e ricalcolo di `nextRunAt`; i comandi in `sent` vengono risolti (`ok` / `error`) quando l'agente risponde.

## Seed
- utente: `admin` / `admin` (bcrypt)
- connector demo: `mikrotik` (MikroTik (example), 192.168.1.1:8728)
- dati demo: 3 VLAN, 5 subnet (1-2 gateway ciascuna), 13 device (alcuni offline)
- pool DHCP: `192.168.1.0/24` → `users` (192.168.1.100-192.168.1.200) e `servers` (192.168.1.10-192.168.1.20); `10.0.0.0/24` → `default` (10.0.0.100-10.0.0.199)
- `10.0.1.0/30` = punto-punto con `includeFirstLast: true` e 2 device
