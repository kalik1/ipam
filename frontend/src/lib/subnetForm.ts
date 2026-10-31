import type { Subnet, Vlan } from '@/types'

export type FormMode = 'create' | 'edit'

export interface PoolDraft {
  name: string
  startIp: string
  endIp: string
}

export interface SubnetDraft {
  name: string
  cidr: string
  gateways: string[]
  includeFirstLast: boolean
  pools: PoolDraft[]
  vlanId: string
  description: string
  domainName: string
  dnsServers: string
  ntpServers: string
}

export interface SubnetBody {
  name: string
  cidr: string
  gateways: string[]
  includeFirstLast: boolean
  dhcpPools: { name?: string; startIp: string; endIp: string }[]
  vlanId?: number | null
  description: string
  domainName: string
  dnsServers: string
  ntpServers: string
}

export interface SelectOption {
  value: string
  label: string
}

export function vlanOptions(vlans: Vlan[]): SelectOption[] {
  return vlans.map((vlan) => ({ value: String(vlan.id), label: `${vlan.vlanId} - ${vlan.name}` }))
}

export function emptySubnetDraft(): SubnetDraft {
  return {
    name: '',
    cidr: '',
    gateways: [],
    includeFirstLast: false,
    pools: [],
    vlanId: '',
    description: '',
    domainName: '',
    dnsServers: '',
    ntpServers: '',
  }
}

export function subnetDraft(subnet?: Subnet): SubnetDraft {
  if (!subnet) return emptySubnetDraft()
  return {
    name: subnet.name,
    cidr: subnet.cidr,
    gateways: [...subnet.gateways],
    includeFirstLast: subnet.includeFirstLast,
    pools: subnet.dhcpPools.map((pool) => ({ name: pool.name, startIp: pool.startIp, endIp: pool.endIp })),
    vlanId: subnet.vlanId === null ? '' : String(subnet.vlanId),
    description: subnet.description ?? '',
    domainName: subnet.domainName ?? '',
    dnsServers: subnet.dnsServers ?? '',
    ntpServers: subnet.ntpServers ?? '',
  }
}

function poolBody(pool: PoolDraft): { name?: string; startIp: string; endIp: string } {
  const name = pool.name.trim()
  const range = { startIp: pool.startIp.trim(), endIp: pool.endIp.trim() }
  return name ? { name, ...range } : range
}

export function subnetBody(draft: SubnetDraft, mode: FormMode): SubnetBody {
  const body: SubnetBody = {
    name: draft.name.trim(),
    cidr: draft.cidr.trim(),
    gateways: draft.gateways.map((gateway) => gateway.trim()).filter(Boolean),
    includeFirstLast: draft.includeFirstLast,
    dhcpPools: draft.pools
      .filter((pool) => pool.startIp.trim() !== '' && pool.endIp.trim() !== '')
      .map(poolBody),
    description: draft.description.trim(),
    domainName: draft.domainName.trim(),
    dnsServers: draft.dnsServers.trim(),
    ntpServers: draft.ntpServers.trim(),
  }
  if (draft.vlanId) body.vlanId = Number(draft.vlanId)
  else if (mode === 'edit') body.vlanId = null
  return body
}
