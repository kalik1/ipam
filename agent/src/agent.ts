const DEFAULT_SERVER = 'http://localhost:3000';
const DEFAULT_AGENT_NAME = 'mock-agent';
const DEFAULT_PLATFORM = 'linux';
const REQUEST_TIMEOUT_MS = 10_000;

interface MockDevice {
  ip: string;
  mac: string;
  hostname: string;
  vendor: string;
}

const MOCK_DEVICES: MockDevice[] = [
  { ip: '192.168.1.10', mac: '00:1A:2B:00:00:01', hostname: 'router', vendor: 'Cisco' },
  { ip: '192.168.1.20', mac: '00:1B:44:00:00:02', hostname: 'pc-dev', vendor: 'Dell' },
  { ip: '192.168.1.30', mac: '3C:5A:6B:00:00:03', hostname: 'laptop-qa', vendor: 'HP' },
  { ip: '10.0.0.5', mac: '00:11:32:00:00:04', hostname: 'nas', vendor: 'Synology' },
  { ip: '10.0.0.6', mac: '00:1A:2B:00:00:05', hostname: 'switch', vendor: 'Cisco' },
  { ip: '172.16.5.100', mac: '3C:5A:6B:00:00:06', hostname: 'print-server', vendor: 'HP' },
];

interface ScanBody {
  agent: string;
  platform: string;
  devices: MockDevice[];
}

interface ScanResponse {
  received: number;
  created: number;
  updated: number;
  reportId: number;
}

interface Options {
  apiKey: string;
  server: string;
  agentName: string;
  platform: string;
  intervalSeconds: number;
}

class ScanError extends Error {}

class InvalidApiKeyError extends ScanError {}

function printUsage(): void {
  console.log(
    [
      'Usage: npm run scan -- [options]',
      '',
      'Options:',
      '  --api-key <key>      API key (or set IPAM_API_KEY env var)',
      `  --server <url>       Server base URL (default: ${DEFAULT_SERVER})`,
      `  --agent-name <name>  Agent name (default: ${DEFAULT_AGENT_NAME})`,
      `  --platform <name>    Platform label (default: ${DEFAULT_PLATFORM})`,
      '  --interval <seconds> Rescan every N seconds; 0 = run once and exit (default: 0)',
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

function parseArgs(argv: string[]): Options {
  let apiKey = process.env['IPAM_API_KEY'] ?? '';
  let server = DEFAULT_SERVER;
  let agentName = DEFAULT_AGENT_NAME;
  let platform = DEFAULT_PLATFORM;
  let intervalSeconds = 0;

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
      case '--interval': {
        const raw = requireValue(argv, i + 1, arg);
        const parsed = Number(raw);
        if (!Number.isFinite(parsed) || parsed < 0) {
          fail('--interval must be a non-negative number of seconds');
        }
        intervalSeconds = parsed;
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

  return { apiKey, server, agentName, platform, intervalSeconds };
}

function describe(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function sendReport(
  server: string,
  apiKey: string,
  body: ScanBody,
): Promise<ScanResponse> {
  const url = `${server.replace(/\/+$/, '')}/api/v1/scan/reports`;
  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': apiKey,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (error) {
    throw new ScanError(`request to ${url} failed: ${describe(error)}`);
  }

  const text = await response.text();
  if (response.status === 401) {
    throw new InvalidApiKeyError('invalid API key');
  }
  if (!response.ok) {
    throw new ScanError(`server returned HTTP ${response.status}: ${text}`);
  }
  try {
    return JSON.parse(text) as ScanResponse;
  } catch {
    throw new ScanError(`invalid JSON in response: ${text}`);
  }
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  if (options.apiKey === '') {
    fail('No API key provided. Use --api-key <key> or set the IPAM_API_KEY env var.');
  }

  const body: ScanBody = {
    agent: options.agentName,
    platform: options.platform,
    devices: MOCK_DEVICES,
  };
  console.log(
    `Mock scan agent: ${MOCK_DEVICES.length} devices, agent="${options.agentName}", platform="${options.platform}"`,
  );
  console.log(`Server: ${options.server}`);

  if (options.intervalSeconds > 0) {
    console.log(`Rescanning every ${options.intervalSeconds}s. Press Ctrl+C to stop.`);
    for (;;) {
      try {
        const result = await sendReport(options.server, options.apiKey, body);
        console.log(`[${new Date().toISOString()}] ${JSON.stringify(result)}`);
      } catch (error) {
        if (error instanceof InvalidApiKeyError) {
          console.error(
            'invalid API key: the server rejected the key (HTTP 401). Check --api-key or IPAM_API_KEY.',
          );
          process.exit(1);
        }
        console.error(`[${new Date().toISOString()}] scan failed: ${describe(error)}`);
        console.error(`Retrying in ${options.intervalSeconds}s.`);
      }
      await sleep(options.intervalSeconds * 1000);
    }
  }

  try {
    const result = await sendReport(options.server, options.apiKey, body);
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    if (error instanceof InvalidApiKeyError) {
      console.error(
        'invalid API key: the server rejected the key (HTTP 401). Check --api-key or IPAM_API_KEY.',
      );
    } else {
      console.error(`Scan failed: ${describe(error)}`);
    }
    process.exitCode = 1;
  }
}

void main();
