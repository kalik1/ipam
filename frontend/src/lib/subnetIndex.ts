import { parseCidr } from './ip'
import { vlanColor, vlanLabel, type VlanTag } from './vlan'

export interface IndexableSubnet {
  id: number
  name: string
  cidr: string
  vlan: VlanTag | null
  deviceCount: number
  totalHosts: number
}

export interface IndexedSubnet {
  id: number
  name: string
  cidr: string
  percent: number
}

export interface VlanCableGroup {
  tag: number | null
  label: string
  color: string
  subnets: IndexedSubnet[]
}

function devicePercent(subnet: IndexableSubnet): number {
  if (subnet.totalHosts <= 0) return 0
  return Math.min(100, Math.round((subnet.deviceCount / subnet.totalHosts) * 100))
}

function compareTags(a: number | null, b: number | null): number {
  if (a === null) return b === null ? 0 : 1
  if (b === null) return -1
  return a - b
}

export function groupSubnetsByVlan(subnets: IndexableSubnet[]): VlanCableGroup[] {
  const groups = new Map<number | null, VlanCableGroup>()
  for (const subnet of subnets) {
    const tag = subnet.vlan?.vlanId ?? null
    let group = groups.get(tag)
    if (!group) {
      group = { tag, label: vlanLabel(subnet.vlan), color: vlanColor(tag), subnets: [] }
      groups.set(tag, group)
    }
    group.subnets.push({ id: subnet.id, name: subnet.name, cidr: subnet.cidr, percent: devicePercent(subnet) })
  }
  const sorted = [...groups.values()].sort((a, b) => compareTags(a.tag, b.tag))
  for (const group of sorted) {
    group.subnets.sort((a, b) => parseCidr(a.cidr).network - parseCidr(b.cidr).network)
  }
  return sorted
}
