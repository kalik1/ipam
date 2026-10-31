export interface Vlan {
  id: number
  vlanId: number
  name: string
  description: string
  createdAt: string
  updatedAt: string
}

export interface DhcpPool {
  id: number
  name: string
  startIp: string
  endIp: string
}

export interface Subnet {
  id: number
  cidr: string
  name: string
  gateways: string[]
  includeFirstLast: boolean
  dhcpPools: DhcpPool[]
  vlanId: number
  vlan: Vlan
  description: string
  domainName: string
  dnsServers: string
  ntpServers: string
  deviceCount: number
  totalHosts: number
  usedHosts: number
  createdAt: string
  updatedAt: string
}

export interface Device {
  id: number
  ip: string
  mac: string
  hostname: string
  vendor: string
  subnetId: number
  subnet: Subnet
  status: 'online' | 'offline'
  lastSeen: string
  notes: string
  createdAt: string
  updatedAt: string
}

export interface VlanDetail extends Vlan {
  subnets: Subnet[]
  deviceCount: number
}

export interface SubnetDetail extends Subnet {
  devices: Device[]
}

export interface TopologyDevice {
  id: number
  ip: string
  hostname: string
  status: 'online' | 'offline'
  lastSeen: string
}

export interface TopologySubnet {
  id: number
  cidr: string
  name: string
  gateways: string[]
  used: number
  total: number
  percent: number
  devices: TopologyDevice[]
}

export interface TopologyVlan {
  id: number | null
  vlanId: number | null
  name: string
  description: string
  subnets: TopologySubnet[]
}

export interface Topology {
  vlans: TopologyVlan[]
}

export interface ApiKey {
  id: number
  name: string
  keyPrefix: string
  createdAt: string
  lastUsedAt: string
}

export interface ApiKeyCreated extends ApiKey {
  key: string
}

export interface ScanReport {
  id: number
  agent: string
  platform: string
  deviceCount: number
  receivedAt: string
}

export interface SubnetUtilization {
  id: number
  name: string
  cidr: string
  used: number
  total: number
  percent: number
}

export interface Summary {
  vlans: number
  subnets: number
  devices: number
  devicesOnline: number
  devicesOffline: number
  subnetsUtilization: SubnetUtilization[]
}

export interface Agent {
  name: string
  platform: string
  connectors: string[]
  connectedAt: string
  lastPingAt: string
}

export interface AgentResult {
  id: string
  ok: boolean
  data?: Record<string, unknown>
  error?: string
  receivedAt: string
}

export interface Connector {
  id: number
  name: string
  label: string
  config: Record<string, unknown>
  createdAt: string
  updatedAt: string
}

export type AssignmentStatus = 'ok' | 'error' | 'skipped' | 'sent'

export interface AgentAssignment {
  id: number
  agentName: string
  connectorId: number
  connector: Connector
  schedule: string
  enabled: boolean
  lastRunAt: string | null
  lastStatus: AssignmentStatus | null
  lastError: string | null
  nextRunAt: string | null
  commandRef: string | null
}

export interface User {
  id: number
  username: string
}

export interface LoginResponse {
  access_token: string
  user: User
}

export interface ApiError {
  message: string
  statusCode: number
}
