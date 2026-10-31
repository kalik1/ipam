import { createApiClient } from 'mikrotik-api/api';
import type {
  Connector,
  ConnectorConfig,
  ConnectorDevice,
  ConnectorDhcpRange,
  ConnectorResult,
  ConnectorReservedIp,
  ConnectorSubnet,
  ConnectorVlan,
} from './types.ts';

type Row = Record<string, string>;

const COMMAND_TIMEOUT_MS = 15_000;

function attr(row: Row | undefined, key: string): string {
  if (!row) return '';
  return row[key] ?? row[`#${key}`] ?? '';
}

function extractTrailingNumber(name: string): number | null {
  const match = name.match(/(\d+)/g);
  if (!match || match.length === 0) return null;
  const value = Number(match[match.length - 1]!);
  return Number.isFinite(value) ? value : null;
}

function networkCidr(ip: string, prefix: number): string | null {
  const num = ipToNumber(ip);
  if (num === null || !Number.isInteger(prefix) || prefix < 0 || prefix > 32) {
    return null;
  }
  const mask = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;
  const network = (num & mask) >>> 0;
  return `${numberToIp(network)}/${prefix}`;
}

function ipToNumber(ip: string): number | null {
  const parts = ip.split('.').map(Number);
  if (
    parts.length !== 4 ||
    parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)
  ) {
    return null;
  }
  const [a, b, c, d] = parts;
  return ((a! << 24) | (b! << 16) | (c! << 8) | d!) >>> 0;
}

function numberToIp(value: number): string {
  return `${(value >>> 24) & 255}.${(value >>> 16) & 255}.${(value >>> 8) & 255}.${
    value & 255
  }`;
}

function splitList(value: string): string[] {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

function parsePoolRange(range: string): { startIp: string; endIp: string } | null {
  const trimmed = range.trim();
  const dash = trimmed.indexOf('-');
  if (dash !== -1) {
    const startIp = trimmed.slice(0, dash).trim();
    const endIp = trimmed.slice(dash + 1).trim();
    if (ipToNumber(startIp) === null || ipToNumber(endIp) === null) return null;
    return { startIp, endIp };
  }
  const slash = trimmed.indexOf('/');
  if (slash === -1) return null;
  const base = ipToNumber(trimmed.slice(0, slash));
  const prefix = Number(trimmed.slice(slash + 1));
  if (base === null || !Number.isInteger(prefix) || prefix < 0 || prefix > 32) {
    return null;
  }
  if (prefix === 32) {
    const ip = numberToIp(base);
    return { startIp: ip, endIp: ip };
  }
  if (prefix === 31) {
    const network = (base & 0xfffffffe) >>> 0;
    return { startIp: numberToIp(network), endIp: numberToIp((network + 1) >>> 0) };
  }
  const mask = (0xffffffff << (32 - prefix)) >>> 0;
  const network = (base & mask) >>> 0;
  const broadcast = (network | (mask ^ 0xffffffff)) >>> 0;
  return {
    startIp: numberToIp((network + 1) >>> 0),
    endIp: numberToIp((broadcast - 1) >>> 0),
  };
}

type ApiClient = ReturnType<typeof createApiClient>;

async function safePrint(client: ApiClient, path: string): Promise<Row[]> {
  try {
    return await client.print(path);
  } catch {
    return [];
  }
}

export function createMikrotikConnector(): Connector {
  return {
    name: 'mikrotik',
    async read(config: ConnectorConfig): Promise<ConnectorResult> {
      const client = createApiClient({
        host: config.host,
        port: config.port,
        username: config.username,
        password: config.password,
        tls: false,
        commandTimeoutMs: COMMAND_TIMEOUT_MS,
      });
      try {
        const [identity, resource, interfaces, addresses, arp, leases, vlanInterfaces, bridgeRows, dnsRows, ntpRows, dhcpNetworks, pools, dhcpServers] =
          await Promise.all([
            client.print('/system/identity'),
            client.print('/system/resource'),
            client.print('/interface'),
            client.print('/ip/address'),
            client.print('/ip/arp'),
            client.print('/ip/dhcp-server/lease'),
            client.print('/interface/vlan'),
            client.print('/interface/bridge'),
            safePrint(client, '/ip/dns'),
            safePrint(client, '/system/ntp/server'),
            safePrint(client, '/ip/dhcp-server/network'),
            safePrint(client, '/ip/pool'),
            safePrint(client, '/ip/dhcp-server'),
          ]);
        const bridgeMembers = await safePrint(client, '/interface/bridge/member');

        const router = {
          name: attr(identity[0], 'name') || attr(resource[0], 'board-name'),
          version: attr(resource[0], 'version'),
          board: attr(resource[0], 'board-name'),
        };
        const interfaceList = interfaces.map((row) => ({
          name: attr(row, 'name'),
          type: attr(row, 'type'),
          running: attr(row, 'running'),
          mtu: attr(row, 'mtu'),
          mac: attr(row, 'mac-address'),
        }));
        const addressList = addresses.map((row) => ({
          address: attr(row, 'address'),
          interface: attr(row, 'interface'),
        }));
        const leaseList = leases.map((row) => ({
          address: attr(row, 'address'),
          mac: attr(row, 'mac-address'),
          hostName: attr(row, 'host-name'),
          interface: attr(row, 'interface'),
        }));

        const leaseByIp = new Map<string, string>();
        for (const lease of leaseList) {
          if (lease.address && lease.hostName) {
            leaseByIp.set(lease.address, lease.hostName);
          }
        }

        const reachableArp = arp.filter((row) => attr(row, 'status') === 'reachable');
        const devices: ConnectorDevice[] = reachableArp.map((row) => {
          const ip = attr(row, 'address');
          const mac = attr(row, 'mac-address');
          const hostname = leaseByIp.get(ip);
          const device: ConnectorDevice = { ip, mac };
          if (hostname) {
            device.hostname = hostname;
          }
          return device;
        });

        const vlanInterfaceVlanId = new Map<string, number>();
        const vlanNameById = new Map<number, string>();
        for (const row of vlanInterfaces) {
          const name = attr(row, 'name');
          const vlanId = Number(attr(row, 'vlan-id'));
          if (!name || !Number.isFinite(vlanId)) continue;
          vlanInterfaceVlanId.set(name, vlanId);
          if (!vlanNameById.has(vlanId)) vlanNameById.set(vlanId, name);
        }
        const vlans: ConnectorVlan[] = [...vlanNameById.entries()].map(([vlanId, name]) => ({
          vlanId,
          name,
        }));
        const knownVlanIds = new Set(vlanNameById.keys());

        const bridgeNames = new Set(bridgeRows.map((row) => attr(row, 'name')));
        const bridgeMemberVlanIds = new Map<string, number[]>();
        for (const member of bridgeMembers) {
          const bridge = attr(member, 'bridge');
          const memberIface = attr(member, 'interface');
          const vid = vlanInterfaceVlanId.get(memberIface);
          if (!bridge || vid === undefined) continue;
          const list = bridgeMemberVlanIds.get(bridge) ?? [];
          if (!list.includes(vid)) list.push(vid);
          bridgeMemberVlanIds.set(bridge, list);
        }

        const resolveBridgeVlanId = (bridgeName: string): number | null => {
          const memberVids = bridgeMemberVlanIds.get(bridgeName);
          if (memberVids && memberVids.length > 0) {
            return memberVids.length === 1 ? memberVids[0]! : null;
          }
          const inferred = extractTrailingNumber(bridgeName);
          return inferred !== null && knownVlanIds.has(inferred) ? inferred : null;
        };

        const subnetConfig = new Map<
          string,
          { domainName?: string; dnsServers: string[]; ntpServers: string[] }
        >();
        for (const row of dhcpNetworks) {
          const address = attr(row, 'address');
          const slash = address.indexOf('/');
          if (slash === -1) continue;
          const cidr = networkCidr(address.slice(0, slash), Number(address.slice(slash + 1)));
          if (!cidr) continue;
          const domainName = attr(row, 'domain');
          const dnsServers = splitList(attr(row, 'dns-server'));
          const ntpServers = splitList(attr(row, 'ntp-server'));
          if (!domainName && dnsServers.length === 0 && ntpServers.length === 0) continue;
          subnetConfig.set(cidr, {
            domainName: domainName || undefined,
            dnsServers,
            ntpServers,
          });
        }
        const globalDnsServers = splitList(attr(dnsRows[0], 'servers'));
        const globalNtpServers = ntpRows
          .map((row) => attr(row, 'address'))
          .filter((value) => value.length > 0);

        const subnets: ConnectorSubnet[] = [];
        const seenCidr = new Set<string>();
        for (const row of addresses) {
          const address = attr(row, 'address');
          const iface = attr(row, 'interface');
          if (!address || !iface) continue;
          const slash = address.indexOf('/');
          if (slash === -1) continue;
          const ipPart = address.slice(0, slash);
          const prefix = Number(address.slice(slash + 1));
          if (prefix === 32) continue;
          const cidr = networkCidr(ipPart, prefix);
          if (!cidr || seenCidr.has(cidr)) continue;
          seenCidr.add(cidr);
          let vlanId: number | null = null;
          const directVid = vlanInterfaceVlanId.get(iface);
          if (directVid !== undefined) {
            vlanId = directVid;
          } else if (bridgeNames.has(iface)) {
            vlanId = resolveBridgeVlanId(iface);
          }
          const config = subnetConfig.get(cidr);
          const dnsServers =
            config && config.dnsServers.length > 0 ? config.dnsServers : globalDnsServers;
          const ntpServers =
            config && config.ntpServers.length > 0 ? config.ntpServers : globalNtpServers;
          const subnet: ConnectorSubnet = { cidr, name: iface, gateway: ipPart };
          if (vlanId !== null) subnet.vlanId = vlanId;
          if (config?.domainName) subnet.domainName = config.domainName;
          if (dnsServers.length > 0) subnet.dnsServers = dnsServers;
          if (ntpServers.length > 0) subnet.ntpServers = ntpServers;
          subnets.push(subnet);
        }

        const reservedIps: ConnectorReservedIp[] = [];
        for (const row of leases) {
          if (attr(row, 'status') !== 'reserved') continue;
          const ip = attr(row, 'address');
          if (!ip) continue;
          const entry: ConnectorReservedIp = { ip };
          const mac = attr(row, 'mac-address');
          if (mac) entry.mac = mac;
          const hostname = attr(row, 'host-name');
          if (hostname) entry.hostname = hostname;
          const server = attr(row, 'server');
          if (server) entry.server = server;
          reservedIps.push(entry);
        }

        const poolRanges = new Map<string, string>();
        for (const row of pools) {
          const name = attr(row, 'name');
          const ranges = attr(row, 'ranges');
          if (name && ranges) poolRanges.set(name, ranges);
        }
        const dhcpRanges: ConnectorDhcpRange[] = [];
        const seenRanges = new Set<string>();
        const addRange = (name: string, range: string): void => {
          const parsed = parsePoolRange(range);
          if (!parsed) return;
          const key = `${parsed.startIp}-${parsed.endIp}`;
          if (seenRanges.has(key)) return;
          seenRanges.add(key);
          dhcpRanges.push({ name, startIp: parsed.startIp, endIp: parsed.endIp });
        };
        if (dhcpServers.length > 0) {
          for (const row of dhcpServers) {
            const poolName = attr(row, 'address-pool');
            const ranges = poolRanges.get(poolName);
            if (!poolName || !ranges) continue;
            for (const range of splitList(ranges)) addRange(poolName, range);
          }
        } else {
          for (const [name, ranges] of poolRanges) {
            for (const range of splitList(ranges)) addRange(name, range);
          }
        }

        return {
          connector: 'mikrotik',
          host: config.host,
          devices,
          vlans,
          subnets,
          reservedIps,
          dhcpRanges,
          meta: {
            router,
            interfaces: interfaceList,
            addresses: addressList,
            leases: leaseList,
            arp: { total: arp.length, reachable: reachableArp.length },
            pools: pools.map((row) => ({
              name: attr(row, 'name'),
              ranges: attr(row, 'ranges'),
            })),
            dhcpServers: dhcpServers.map((row) => ({
              name: attr(row, 'name'),
              interface: attr(row, 'interface'),
              addressPool: attr(row, 'address-pool'),
            })),
            bridgeVlanMapping:
              bridgeMemberVlanIds.size > 0 ? 'bridge-members' : 'inferred-from-name',
          },
        };
      } finally {
        await client.close();
      }
    },
  };
}
