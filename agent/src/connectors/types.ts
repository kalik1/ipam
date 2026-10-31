export interface ConnectorConfig {
  host: string;
  port: number;
  username: string;
  password: string;
}

export interface ConnectorDevice {
  ip: string;
  mac?: string;
  hostname?: string;
  vendor?: string;
}

export interface ConnectorVlan {
  vlanId: number;
  name: string;
}

export interface ConnectorSubnet {
  cidr: string;
  name: string;
  gateway?: string;
  vlanId?: number | null;
  domainName?: string;
  dnsServers?: string[];
  ntpServers?: string[];
}

export interface ConnectorReservedIp {
  ip: string;
  mac?: string;
  hostname?: string;
  server?: string;
}

export interface ConnectorDhcpRange {
  name: string;
  startIp: string;
  endIp: string;
}

export interface ConnectorResult {
  connector: string;
  host: string;
  devices: ConnectorDevice[];
  vlans?: ConnectorVlan[];
  subnets?: ConnectorSubnet[];
  reservedIps?: ConnectorReservedIp[];
  dhcpRanges?: ConnectorDhcpRange[];
  meta?: Record<string, unknown>;
}

export interface Connector {
  name: string;
  read(params: unknown): Promise<ConnectorResult>;
}
