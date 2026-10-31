import type { AddressMapDevice, AddressMapSubnet } from './addressMap'
import { parseCidr } from './ip'
import { subnetOccupancy, type Occupancy } from './occupancy'
import { vlanColor, vlanLabel, type VlanTag } from './vlan'

export interface IndexableSubnet extends AddressMapSubnet {
  id: number
  name: string
  vlan: VlanTag | null
}

export interface IndexedSubnet {
  id: number
  name: string
  cidr: string
  occupancy: Occupancy
}

export interface VlanCableGroup {
  tag: number | null
  label: string
  color: string
  subnets: IndexedSubnet[]
}

const NO_DEVICES: readonly AddressMapDevice[] = []

function compareTags(a: number | null, b: number | null): number {
  if (a === null) return b === null ? 0 : 1
  if (b === null) return -1
  return a - b
}

export function groupSubnetsByVlan(
  subnets: readonly IndexableSubnet[],
  devices: ReadonlyMap<number, readonly AddressMapDevice[]>,
): VlanCableGroup[] {
  const groups = new Map<number | null, VlanCableGroup>()
  for (const subnet of subnets) {
    const tag = subnet.vlan?.vlanId ?? null
    let group = groups.get(tag)
    if (!group) {
      group = { tag, label: vlanLabel(subnet.vlan), color: vlanColor(tag), subnets: [] }
      groups.set(tag, group)
    }
    const occupancy = subnetOccupancy(subnet, devices.get(subnet.id) ?? NO_DEVICES)
    group.subnets.push({ id: subnet.id, name: subnet.name, cidr: subnet.cidr, occupancy })
  }
  const sorted = [...groups.values()].sort((a, b) => compareTags(a.tag, b.tag))
  for (const group of sorted) {
    group.subnets.sort((a, b) => parseCidr(a.cidr).network - parseCidr(b.cidr).network)
  }
  return sorted
}
