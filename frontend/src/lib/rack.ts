import type { AddressCounters, AddressMap } from './addressMap'
import type { TopologyBranch, TopologySubnetNode } from './topology'

export type RackCell = 'on' | 'off' | 'res' | 'na' | 'free'

export interface RackRow {
  id: number
  name: string
  cidr: string
  href: string
  color: string
  vlanLabel: string
  counters: AddressCounters
  cells: RackCell[]
  pools: { count: number; size: number }
  freePercent: number
  low: boolean
}

export interface RackSummary {
  counters: AddressCounters
  freePercent: number
  low: number
  subnets: number
  vlans: number
}

export interface RackVlan {
  key: string
  label: string
  color: string
}

export interface Rack {
  rows: RackRow[]
  summary: RackSummary
  vlans: RackVlan[]
}

export const RACK_CELLS = 256
export const LOW_FREE_RATIO = 0.1

export function freePercent(counters: Pick<AddressCounters, 'usable' | 'free'>): number {
  return counters.usable > 0 ? Math.floor((counters.free / counters.usable) * 100) : 0
}

export function isLowOnFree(counters: Pick<AddressCounters, 'usable' | 'free'>): boolean {
  return counters.usable > 0 && counters.free / counters.usable < LOW_FREE_RATIO
}

function cellState(counters: AddressCounters): RackCell {
  if (counters.occupiedOnline > 0) return 'on'
  if (counters.occupied > 0) return 'off'
  if (counters.reserved > 0) return 'res'
  if (counters.usable === 0) return 'na'
  return 'free'
}

export function rackCells(map: Pick<AddressMap, 'network' | 'size' | 'count'>, limit = RACK_CELLS): RackCell[] {
  const cells = Math.min(map.size, limit)
  const per = map.size / cells
  return Array.from({ length: cells }, (_, index) => {
    const first = map.network + index * per
    return cellState(map.count(first, first + per - 1))
  })
}

function rackRow(node: TopologySubnetNode, branch: TopologyBranch): RackRow {
  return {
    id: node.id,
    name: node.name,
    cidr: node.cidr,
    href: node.href,
    color: branch.color,
    vlanLabel: branch.label,
    counters: node.counters,
    cells: rackCells(node.map),
    pools: { count: node.map.pools.length, size: node.map.pools.reduce((total, usage) => total + usage.size, 0) },
    freePercent: freePercent(node.counters),
    low: isLowOnFree(node.counters),
  }
}

const NO_ADDRESSES: AddressCounters = { usable: 0, occupied: 0, occupiedOnline: 0, occupiedOffline: 0, reserved: 0, free: 0 }

function addCounters(a: AddressCounters, b: AddressCounters): AddressCounters {
  return {
    usable: a.usable + b.usable,
    occupied: a.occupied + b.occupied,
    occupiedOnline: a.occupiedOnline + b.occupiedOnline,
    occupiedOffline: a.occupiedOffline + b.occupiedOffline,
    reserved: a.reserved + b.reserved,
    free: a.free + b.free,
  }
}

function summarize(rows: RackRow[], branches: readonly TopologyBranch[]): RackSummary {
  const counters = rows.reduce((total, row) => addCounters(total, row.counters), NO_ADDRESSES)
  return {
    counters,
    freePercent: freePercent(counters),
    low: rows.filter((row) => row.low).length,
    subnets: rows.length,
    vlans: branches.filter((branch) => branch.tag !== null).length,
  }
}

export function buildRack(branches: readonly TopologyBranch[]): Rack {
  const rows = branches.flatMap((branch) => branch.subnets.map((node) => rackRow(node, branch)))
  const vlans = branches.filter((branch) => branch.subnets.length > 0).map(({ key, label, color }) => ({ key, label, color }))
  return { rows, summary: summarize(rows, branches), vlans }
}
