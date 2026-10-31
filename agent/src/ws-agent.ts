import { createDemoConnector } from './connectors/demo.ts';
import { createMikrotikConnector } from './connectors/mikrotik.ts';
import type { Connector } from './connectors/types.ts';

const DEFAULT_SERVER = 'ws://localhost:3000';
const DEFAULT_AGENT_NAME = 'mock-agent';
const DEFAULT_PLATFORM = 'linux';
const PING_INTERVAL_MS = 30_000;
const BACKOFF_INITIAL_MS = 1_000;
const BACKOFF_MAX_MS = 30_000;

const CONNECTORS: Record<string, Connector> = {
  mikrotik: createMikrotikConnector(),
  demo: createDemoConnector(),
};

interface WsOptions {
  apiKey: string;
  server: string;
  agentName: string;
  platform: string;
  connectors: string[];
}

function printUsage(): void {
  console.log(
    [
      'Usage: npm run ws -- [options]',
      '',
      'Options:',
      '  --api-key <key>      API key (or set IPAM_API_KEY env var)',
      `  --server <url>       Server WS base URL (default: ${DEFAULT_SERVER})`,
      `  --agent-name <name>  Agent name (default: ${DEFAULT_AGENT_NAME})`,
      `  --platform <name>    Platform label (default: ${DEFAULT_PLATFORM})`,
      `  --connector <name>   Connector to register (repeatable); supported: ${Object.keys(CONNECTORS).join(', ')}`,
      '  -h, --help           Show this help',
    ].join('\n'),
  );
}

function fail(message: string): never {
  console.error(`Error: ${message}`);
  process.exit(1);
}

function requireValue(args: string[], valueIndex: number, flag: string): string {
  const value = args[valueIndex];
  if (value === undefined || value.startsWith('--')) {
    fail(`Missing value for ${flag}`);
  }
  return value;
}

function parseArgs(argv: string[]): WsOptions {
  let apiKey = process.env['IPAM_API_KEY'] ?? '';
  let server = DEFAULT_SERVER;
  let agentName = DEFAULT_AGENT_NAME;
  let platform = DEFAULT_PLATFORM;
  const connectorNames: string[] = [];

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i] ?? '';
    switch (arg) {
      case '--api-key':
        apiKey = requireValue(argv, i + 1, arg);
        i += 1;
        break;
      case '--server':
        server = requireValue(argv, i + 1, arg);
        i += 1;
        break;
      case '--agent-name':
        agentName = requireValue(argv, i + 1, arg);
        i += 1;
        break;
      case '--platform':
        platform = requireValue(argv, i + 1, arg);
        i += 1;
        break;
      case '--connector': {
        const value = requireValue(argv, i + 1, arg);
        if (!(value in CONNECTORS)) {
          fail(
            `Unknown connector "${value}". Supported connectors: ${Object.keys(CONNECTORS).join(', ')}`,
          );
        }
        if (!connectorNames.includes(value)) {
          connectorNames.push(value);
        }
        i += 1;
        break;
      }
      case '-h':
      case '--help':
        printUsage();
        process.exit(0);
        break;
      default:
        fail(`Unknown argument: ${arg}\n`);
    }
  }

  return { apiKey, server, agentName, platform, connectors: connectorNames };
}

function describe(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

function toWsUrl(server: string): string {
  let base = server.replace(/\/+$/, '');
  if (base.startsWith('https://')) {
    base = base.replace('https://', 'wss://');
  } else if (base.startsWith('http://')) {
    base = base.replace('http://', 'ws://');
  }
  return `${base}/ws/agent`;
}

function toText(data: unknown): string {
  if (typeof data === 'string') {
    return data;
  }
  if (data instanceof ArrayBuffer) {
    return Buffer.from(new Uint8Array(data)).toString('utf8');
  }
  if (ArrayBuffer.isView(data)) {
    const view = data as Uint8Array;
    return Buffer.from(view.buffer, view.byteOffset, view.byteLength).toString('utf8');
  }
  return String(data);
}

class WsAgent {
  private readonly wsUrl: string;
  private readonly agentName: string;
  private readonly platform: string;
  private readonly apiKey: string;
  private readonly connectorNames: string[];
  private ws: WebSocket | null = null;
  private backoffMs = BACKOFF_INITIAL_MS;
  private pingTimer: NodeJS.Timeout | null = null;
  private stopped = false;

  constructor(options: {
    wsUrl: string;
    agentName: string;
    platform: string;
    apiKey: string;
    connectorNames: string[];
  }) {
    this.wsUrl = options.wsUrl;
    this.agentName = options.agentName;
    this.platform = options.platform;
    this.apiKey = options.apiKey;
    this.connectorNames = options.connectorNames;
  }

  start(): void {
    this.connect();
  }

  stop(): void {
    this.stopped = true;
    this.stopPing();
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  private connect(): void {
    if (this.stopped) {
      return;
    }
    let ws: WebSocket;
    try {
      ws = new WebSocket(this.wsUrl);
    } catch (error) {
      this.scheduleReconnect(`failed to open socket: ${describe(error)}`);
      return;
    }
    this.ws = ws;

    ws.addEventListener('open', () => {
      console.log(`ws-agent: connected to ${this.wsUrl}`);
      this.sendJson({
        type: 'hello',
        agent: this.agentName,
        platform: this.platform,
        apiKey: this.apiKey,
        connectors: this.connectorNames,
      });
    });

    ws.addEventListener('message', (event: MessageEvent) => {
      const data: unknown = event.data;
      this.onMessage(data);
    });

    ws.addEventListener('error', (event) => {
      console.error(`ws-agent: socket error: ${event.message}`);
    });

    ws.addEventListener('close', (event: CloseEvent) => {
      this.stopPing();
      this.ws = null;
      if (this.stopped) {
        return;
      }
      console.log(
        `ws-agent: disconnected (code ${event.code}, ${event.reason || 'no reason'})`,
      );
      this.scheduleReconnect();
    });
  }

  private scheduleReconnect(reason?: string): void {
    if (this.stopped) {
      return;
    }
    const delay = this.backoffMs;
    this.backoffMs = Math.min(this.backoffMs * 2, BACKOFF_MAX_MS);
    console.log(
      `ws-agent: reconnecting in ${delay}ms${reason ? ` (${reason})` : ''}`,
    );
    setTimeout(() => this.connect(), delay);
  }

  private onMessage(data: unknown): void {
    const text = toText(data);
    let raw: unknown;
    try {
      raw = JSON.parse(text);
    } catch {
      console.error(`ws-agent: ignoring invalid JSON from server: ${text}`);
      return;
    }
    if (typeof raw !== 'object' || raw === null) {
      return;
    }
    const message = raw as Record<string, unknown>;
    const type = message['type'];
    if (type === 'hello_ack') {
      this.onHelloAck(message);
    } else if (type === 'command') {
      this.onCommand(message).catch((error: unknown) => {
        console.error(`ws-agent: command handler failed: ${describe(error)}`);
      });
    } else if (type === 'error') {
      console.error(`ws-agent: server error: ${String(message['message'] ?? 'unknown')}`);
    } else if (type === 'pong') {
      // liveness confirmed; nothing to do
    }
  }

  private onHelloAck(message: Record<string, unknown>): void {
    if (message['ok'] === true) {
      this.backoffMs = BACKOFF_INITIAL_MS;
      console.log(
        `ws-agent: authenticated as "${this.agentName}" ` +
          `(platform ${this.platform}, connectors [${this.connectorNames.join(', ')}])`,
      );
      this.startPing();
      return;
    }
    const error = message['error'] ?? 'unknown';
    console.error(
      `ws-agent: server rejected hello (${String(error)}). ` +
        'Check --api-key or IPAM_API_KEY.',
    );
    this.stopped = true;
    process.exit(1);
  }

  private async onCommand(message: Record<string, unknown>): Promise<void> {
    const id = message['id'];
    if (typeof id !== 'string' || id.length === 0) {
      console.error('ws-agent: command missing id; ignoring');
      return;
    }
    const action = message['action'];
    if (action !== 'run_connector') {
      this.sendResult(id, false, `unsupported action "${String(action)}"`);
      return;
    }
    const connectorName = message['connector'];
    if (typeof connectorName !== 'string') {
      this.sendResult(id, false, 'command missing connector name');
      return;
    }
    const connector = CONNECTORS[connectorName];
    if (!connector) {
      this.sendResult(
        id,
        false,
        `unknown connector "${connectorName}"; supported: ${Object.keys(CONNECTORS).join(', ')}`,
      );
      return;
    }
    console.log(`ws-agent: running connector "${connectorName}"`);
    try {
      const result = await connector.read(message['params']);
      this.sendResult(id, true, result);
      console.log(
        `ws-agent: connector "${connectorName}" returned ${result.devices.length} device(s)`,
      );
    } catch (error) {
      const messageText = describe(error);
      console.error(`ws-agent: connector "${connectorName}" failed: ${messageText}`);
      this.sendResult(id, false, messageText);
    }
  }

  private sendResult(id: string, ok: boolean, dataOrError: unknown): void {
    const payload: Record<string, unknown> = { type: 'result', id, ok };
    if (ok) {
      payload['data'] = dataOrError;
    } else {
      payload['error'] = typeof dataOrError === 'string' ? dataOrError : 'unknown error';
    }
    this.sendJson(payload);
  }

  private sendJson(payload: unknown): void {
    const ws = this.ws;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(payload));
    }
  }

  private startPing(): void {
    this.stopPing();
    this.pingTimer = setInterval(() => {
      this.sendJson({ type: 'ping' });
    }, PING_INTERVAL_MS);
  }

  private stopPing(): void {
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
  }
}

function main(): void {
  const options = parseArgs(process.argv.slice(2));
  if (options.apiKey === '') {
    fail('No API key provided. Use --api-key <key> or set the IPAM_API_KEY env var.');
  }
  const agent = new WsAgent({
    wsUrl: toWsUrl(options.server),
    agentName: options.agentName,
    platform: options.platform,
    apiKey: options.apiKey,
    connectorNames: options.connectors,
  });
  console.log(
    `ws-agent: agent="${options.agentName}", platform="${options.platform}", ` +
      `connectors=[${options.connectors.join(', ')}], server=${options.server}`,
  );
  agent.start();
  const shutdown = (): void => {
    console.log('ws-agent: shutting down');
    agent.stop();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main();
