import { ipToNumber, totalHosts } from './cidr';
import { Subnet } from '../entities/subnet.entity';
import { Vlan } from '../entities/vlan.entity';
import { Gateway } from '../entities/gateway.entity';
import { DhcpPool } from '../entities/dhcp-pool.entity';

export interface DhcpPoolResponse {
  id: number;
  name: string;
  startIp: string;
  endIp: string;
}

export interface SubnetResponse {
  id: number;
  cidr: string;
  name: string;
  gateways: string[];
  includeFirstLast: boolean;
  dhcpPools: DhcpPoolResponse[];
  vlanId: number | null;
  vlan: Vlan | null;
  description: string;
  domainName: string;
  dnsServers: string;
  ntpServers: string;
  deviceCount: number;
  totalHosts: number;
  usedHosts: number;
  createdAt: Date;
  updatedAt: Date;
}

export function subnetGatewayIps(subnet: Subnet): string[] {
  return [...(subnet.gateways ?? [])]
    .sort((a: Gateway, b: Gateway) => ipToNumber(a.ip) - ipToNumber(b.ip))
    .map((gateway) => gateway.ip);
}

export function toPoolResponse(pool: DhcpPool): DhcpPoolResponse {
  return {
    id: pool.id,
    name: pool.name,
    startIp: pool.startIp,
    endIp: pool.endIp,
  };
}

export function subnetPoolResponses(subnet: Subnet): DhcpPoolResponse[] {
  return (subnet.dhcpPools ?? []).map(toPoolResponse);
}

export function toSubnetResponse(
  subnet: Subnet,
  deviceCount: number,
): SubnetResponse {
  return {
    id: subnet.id,
    cidr: subnet.cidr,
    name: subnet.name,
    gateways: subnetGatewayIps(subnet),
    includeFirstLast: subnet.includeFirstLast,
    dhcpPools: subnetPoolResponses(subnet),
    vlanId: subnet.vlanId,
    vlan: subnet.vlan ?? null,
    description: subnet.description,
    domainName: subnet.domainName ?? '',
    dnsServers: subnet.dnsServers ?? '',
    ntpServers: subnet.ntpServers ?? '',
    deviceCount,
    totalHosts: totalHosts(subnet.cidr, subnet.includeFirstLast),
    usedHosts: deviceCount,
    createdAt: subnet.createdAt,
    updatedAt: subnet.updatedAt,
  };
}
