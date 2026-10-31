import { buildAddressMap, type AddressMapDevice, type AddressMapSubnet } from './addressMap'
import { freePercent } from './rack'
import type { Topology, TopologyDevice } from '../types'

export interface Occupancy {
  occupied: number
  reserved: number
  free: number
  usable: number
  freePercent: number
  allocatedPercent: number
}

type Counts = Pick<Occupancy, 'occupied' | 'reserved' | 'free' | 'usable'>

function withPercents(counts: Counts): Occupancy {
  const free = freePercent(counts)
  return { ...counts, freePercent: free, allocatedPercent: counts.usable > 0 ? 100 - free : 0 }
}

export function subnetOccupancy(subnet: AddressMapSubnet, devices: readonly AddressMapDevice[]): Occupancy {
  const { occupied, reserved, free, usable } = buildAddressMap(subnet, devices).counters
  return withPercents({ occupied, reserved, free, usable })
}

export function sumOccupancy(list: readonly Occupancy[]): Occupancy {
  const total = (key: keyof Counts) => list.reduce((sum, occupancy) => sum + occupancy[key], 0)
  return withPercents({ occupied: total('occupied'), reserved: total('reserved'), free: total('free'), usable: total('usable') })
}

export function occupancyText({ occupied, reserved, free, usable }: Occupancy): string {
  if (usable === 0) return 'No usable addresses'
  return `${occupied} occupied, ${reserved} reserved, ${free} free of ${usable} usable addresses`
}

export function devicesBySubnet(topology: Topology): Map<number, TopologyDevice[]> {
  return new Map(topology.vlans.flatMap((vlan) => vlan.subnets.map((subnet) => [subnet.id, subnet.devices] as const)))
}
