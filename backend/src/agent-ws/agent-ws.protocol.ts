export interface HelloIn {
  type: 'hello';
  agent: string;
  platform: string;
  apiKey: string;
  connectors: string[];
}

export interface PingIn {
  type: 'ping';
}

export interface ReportDeviceIn {
  ip: string;
  mac?: string;
  hostname?: string;
  vendor?: string;
}

export interface ReportIn {
  type: 'report';
  platform: string;
  devices: ReportDeviceIn[];
}

export interface ResultIn {
  type: 'result';
  id: string;
  ok: boolean;
  data?: Record<string, unknown>;
  error?: string;
}

export type AgentInbound = HelloIn | PingIn | ReportIn | ResultIn;

export type ParsedInbound = { message: AgentInbound } | { error: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

const OPTIONAL_DEVICE_FIELDS = ['mac', 'hostname', 'vendor'] as const;

function normalizeDevice(
  device: Record<string, unknown>,
): ReportDeviceIn | null {
  if (typeof device.ip !== 'string' || device.ip.length === 0) return null;
  const entry: ReportDeviceIn = { ip: device.ip };
  for (const field of OPTIONAL_DEVICE_FIELDS) {
    const value = device[field];
    if (value === undefined) continue;
    if (typeof value !== 'string') return null;
    entry[field] = value;
  }
  return entry;
}

export function extractDevices(data: unknown): ReportDeviceIn[] | null {
  if (!isRecord(data)) return null;
  const devices = data.devices;
  if (!Array.isArray(devices)) return null;
  const result: ReportDeviceIn[] = [];
  for (const device of devices) {
    if (!isRecord(device)) return null;
    const normalized = normalizeDevice(device);
    if (!normalized) return null;
    result.push(normalized);
  }
  return result;
}

export interface ImportVlanIn {
  vlanId: number;
  name: string;
}

export interface ImportSubnetIn {
  cidr: string;
  name: string;
  gateway?: string;
  vlanId?: number | null;
  domainName?: string;
  dnsServers?: string[];
  ntpServers?: string[];
}

export interface ImportReservedIpIn {
  ip: string;
  mac?: string;
  hostname?: string;
}

export interface ImportDhcpRangeIn {
  name: string;
  startIp: string;
  endIp: string;
}

export interface ExtractedNetwork {
  vlans: ImportVlanIn[];
  subnets: ImportSubnetIn[];
  reservedIps: ImportReservedIpIn[];
  dhcpRanges: ImportDhcpRangeIn[];
}

function extractStringArray(value: unknown): string[] | null | undefined {
  if (value === undefined) return undefined;
  if (!isStringArray(value)) return null;
  return value;
}

export function extractNetwork(data: unknown): ExtractedNetwork | null {
  if (!isRecord(data)) return null;
  const vlans: ImportVlanIn[] = [];
  const subnets: ImportSubnetIn[] = [];
  const reservedIps: ImportReservedIpIn[] = [];
  const dhcpRanges: ImportDhcpRangeIn[] = [];
  if (data.vlans !== undefined) {
    if (!Array.isArray(data.vlans)) return null;
    for (const item of data.vlans) {
      if (
        !isRecord(item) ||
        typeof item.vlanId !== 'number' ||
        !Number.isInteger(item.vlanId) ||
        typeof item.name !== 'string'
      ) {
        return null;
      }
      vlans.push({ vlanId: item.vlanId, name: item.name });
    }
  }
  if (data.subnets !== undefined) {
    if (!Array.isArray(data.subnets)) return null;
    for (const item of data.subnets) {
      if (!isRecord(item) || typeof item.cidr !== 'string' || typeof item.name !== 'string') {
        return null;
      }
      const subnet: ImportSubnetIn = { cidr: item.cidr, name: item.name };
      if (item.gateway !== undefined) {
        if (typeof item.gateway !== 'string') return null;
        subnet.gateway = item.gateway;
      }
      if (item.vlanId !== undefined) {
        if (
          item.vlanId !== null &&
          (typeof item.vlanId !== 'number' || !Number.isInteger(item.vlanId))
        ) {
          return null;
        }
        subnet.vlanId = item.vlanId;
      }
      if (item.domainName !== undefined) {
        if (typeof item.domainName !== 'string') return null;
        subnet.domainName = item.domainName;
      }
      for (const field of ['dnsServers', 'ntpServers'] as const) {
        if (item[field] === undefined) continue;
        const values = extractStringArray(item[field]);
        if (values === null) return null;
        subnet[field] = values;
      }
      subnets.push(subnet);
    }
  }
  if (data.reservedIps !== undefined) {
    if (!Array.isArray(data.reservedIps)) return null;
    for (const item of data.reservedIps) {
      if (!isRecord(item) || typeof item.ip !== 'string' || item.ip.length === 0) {
        return null;
      }
      const entry: ImportReservedIpIn = { ip: item.ip };
      for (const field of ['mac', 'hostname'] as const) {
        if (item[field] === undefined) continue;
        if (typeof item[field] !== 'string') return null;
        entry[field] = item[field];
      }
      reservedIps.push(entry);
    }
  }
  if (data.dhcpRanges !== undefined) {
    if (!Array.isArray(data.dhcpRanges)) return null;
    for (const item of data.dhcpRanges) {
      if (
        !isRecord(item) ||
        typeof item.name !== 'string' ||
        typeof item.startIp !== 'string' ||
        typeof item.endIp !== 'string'
      ) {
        return null;
      }
      dhcpRanges.push({ name: item.name, startIp: item.startIp, endIp: item.endIp });
    }
  }
  if (
    vlans.length === 0 &&
    subnets.length === 0 &&
    reservedIps.length === 0 &&
    dhcpRanges.length === 0
  ) {
    return null;
  }
  return { vlans, subnets, reservedIps, dhcpRanges };
}

export function parseInbound(raw: string): ParsedInbound {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { error: 'invalid_json' };
  }
  if (!isRecord(parsed)) return { error: 'invalid_message' };
  if (typeof parsed.type !== 'string') return { error: 'missing_type' };

  switch (parsed.type) {
    case 'hello': {
      const { agent, platform, apiKey, connectors } = parsed;
      if (
        typeof agent !== 'string' ||
        agent.length === 0 ||
        agent.length > 100
      ) {
        return { error: 'invalid_agent' };
      }
      if (typeof platform !== 'string') return { error: 'invalid_platform' };
      if (typeof apiKey !== 'string' || apiKey.length === 0) {
        return { error: 'invalid_api_key' };
      }
      if (!isStringArray(connectors)) return { error: 'invalid_connectors' };
      return {
        message: { type: 'hello', agent, platform, apiKey, connectors },
      };
    }
    case 'ping':
      return { message: { type: 'ping' } };
    case 'report': {
      const { platform, devices } = parsed;
      if (typeof platform !== 'string') return { error: 'invalid_platform' };
      if (!Array.isArray(devices)) return { error: 'invalid_devices' };
      const normalized: ReportDeviceIn[] = [];
      for (const device of devices) {
        if (!isRecord(device)) return { error: 'invalid_device' };
        const entry = normalizeDevice(device);
        if (!entry) return { error: 'invalid_device' };
        normalized.push(entry);
      }
      return {
        message: { type: 'report', platform, devices: normalized },
      };
    }
    case 'result': {
      const { id, ok } = parsed;
      if (typeof id !== 'string' || id.length === 0) {
        return { error: 'invalid_id' };
      }
      if (typeof ok !== 'boolean') return { error: 'invalid_ok' };
      const message: ResultIn = { type: 'result', id, ok };
      if (ok) {
        if (!isRecord(parsed.data)) return { error: 'invalid_data' };
        message.data = parsed.data;
      } else if (typeof parsed.error !== 'string') {
        return { error: 'invalid_error' };
      } else {
        message.error = parsed.error;
      }
      return { message };
    }
    default:
      return { error: 'unknown_type' };
  }
}
