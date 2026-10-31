import type { Connector, ConnectorDevice, ConnectorResult } from './types.ts';

const MIN_DELAY_MS = 800;
const MAX_DELAY_MS = 2_000;
const SOMETIMES_CHANCE = 0.5;

const ALWAYS_SEEN: ConnectorDevice[] = [
  { ip: '10.0.0.10', mac: 'AA:BB:CC:01:00:0A', hostname: 'core-switch', vendor: 'Cisco' },
  { ip: '192.168.1.10', mac: 'AA:BB:CC:10:00:0A', hostname: 'workstation-01', vendor: 'HP' },
  { ip: '192.168.1.20', mac: 'AA:BB:CC:10:00:14', hostname: 'workstation-02', vendor: 'Dell' },
  { ip: '172.16.0.10', mac: 'AA:BB:CC:20:00:0A', hostname: 'web-server-01', vendor: 'Supermicro' },
];

const SOMETIMES_SEEN: ConnectorDevice[] = [
  { ip: '10.0.0.20', mac: 'AA:BB:CC:01:00:14', hostname: 'firewall', vendor: 'Palo Alto' },
  { ip: '192.168.1.30', mac: 'AA:BB:CC:10:00:1E', hostname: 'printer-01', vendor: 'HP' },
  { ip: '192.168.1.42', mac: 'DC:A6:32:4E:10:2A', hostname: 'lab-pi', vendor: 'Raspberry Pi' },
  { ip: '192.168.2.10', mac: 'AA:BB:CC:11:00:0A', hostname: 'nas-01', vendor: 'Synology' },
  { ip: '192.168.2.77', mac: '3C:22:FB:9A:01:4D', hostname: 'phone-01', vendor: 'Apple' },
  { ip: '172.16.0.20', mac: 'AA:BB:CC:20:00:14', hostname: 'db-server-01', vendor: 'Dell' },
  { ip: '172.16.4.15', mac: '00:15:5D:04:0F:01', hostname: 'build-runner', vendor: 'Microsoft' },
];

function pause(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function createDemoConnector(): Connector {
  return {
    name: 'demo',
    async read(): Promise<ConnectorResult> {
      await pause(MIN_DELAY_MS + Math.random() * (MAX_DELAY_MS - MIN_DELAY_MS));
      const devices = [
        ...ALWAYS_SEEN,
        ...SOMETIMES_SEEN.filter(() => Math.random() < SOMETIMES_CHANCE),
      ];
      return { connector: 'demo', host: 'simulated', devices };
    },
  };
}
