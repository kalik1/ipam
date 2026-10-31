import { buildAddressMap, type AddressCounters, type AddressMap, type AddressMapSubnet, type AddressSlot } from './addressMap'
import { ipToNumber } from './ip'
import { vlanColor, vlanLabel } from './vlan'
import type { Subnet, Topology, TopologyDevice, TopologySubnet, TopologyVlan } from '@/types'

export type TopologySubnetRow = Pick<Subnet, 'id' | 'cidr' | 'gateways' | 'dhcpPools' | 'includeFirstLast'>

export interface TopologyPort {
  device: TopologyDevice
  slot: AddressSlot<TopologyDevice>
  href: string
}

export interface TopologySubnetNode {
  id: number
  name: string
  cidr: string
  prefix: number
  gateways: string[]
  href: string
  counters: AddressCounters
  map: AddressMap<TopologyDevice>
  ports: TopologyPort[]
}

export interface TopologyBranch {
  key: string
  tag: number | null
  label: string
  description: string
  color: string
  subnets: TopologySubnetNode[]
}

function addressSubnet(subnet: TopologySubnet, row: TopologySubnetRow | undefined): AddressMapSubnet {
  return row ?? { cidr: subnet.cidr, gateways: subnet.gateways, dhcpPools: [], includeFirstLast: false }
}

function ipValue(ip: string): number {
  try {
    return ipToNumber(ip)
  } catch {
    return Number.MAX_SAFE_INTEGER
  }
}

function straySlot(device: TopologyDevice): AddressSlot<TopologyDevice> {
  return { ip: device.ip, value: ipValue(device.ip), state: 'occupied', device, gateway: false, pools: [], notUsable: null }
}

function subnetNode(subnet: TopologySubnet, row: TopologySubnetRow | undefined): TopologySubnetNode {
  const map = buildAddressMap(addressSubnet(subnet, row), subnet.devices)
  const href = `/subnets/${subnet.id}`
  const ports = subnet.devices
    .map((device) => {
      const slot = map.slot(device.ip)
      return {
        device,
        slot: slot?.device === device ? slot : straySlot(device),
        href: `${href}?${new URLSearchParams({ ip: device.ip })}`,
      }
    })
    .sort((a, b) => a.slot.value - b.slot.value)
  return { id: subnet.id, name: subnet.name, cidr: subnet.cidr, prefix: map.prefix, gateways: subnet.gateways, href, counters: map.counters, map, ports }
}

function branch(vlan: TopologyVlan, rows: ReadonlyMap<number, TopologySubnetRow>): TopologyBranch {
  const tag = vlan.vlanId
  return {
    key: vlan.id === null ? 'none' : String(vlan.id),
    tag,
    label: vlanLabel(tag === null ? null : { vlanId: tag, name: vlan.name }),
    description: vlan.description,
    color: vlanColor(tag),
    subnets: vlan.subnets.map((subnet) => subnetNode(subnet, rows.get(subnet.id))),
  }
}

export function buildTopologyTree(topology: Topology, subnets: readonly TopologySubnetRow[]): TopologyBranch[] {
  const rows = new Map(subnets.map((row) => [row.id, row]))
  return topology.vlans.map((vlan) => branch(vlan, rows))
}
