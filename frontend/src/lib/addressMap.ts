import { ipToNumber, numberToIp, parseCidr } from './ip'

export type AddressState = 'occupied' | 'reserved' | 'free' | 'not-usable'

export interface AddressMapPool {
  id: number
  name: string
  startIp: string
  endIp: string
}

export interface AddressMapSubnet {
  cidr: string
  gateways: readonly string[]
  dhcpPools: readonly AddressMapPool[]
  includeFirstLast: boolean
}

export interface AddressMapDevice {
  id: number
  ip: string
  status: 'online' | 'offline'
}

export interface AddressCounters {
  usable: number
  occupied: number
  occupiedOnline: number
  occupiedOffline: number
  reserved: number
  free: number
}

export interface AddressSlot<D extends AddressMapDevice = AddressMapDevice> {
  ip: string
  value: number
  state: AddressState
  device: D | null
  gateway: boolean
  pools: AddressMapPool[]
  notUsable: 'network' | 'broadcast' | null
}

export type AddressRole = 'gateway' | 'dhcp-client' | 'static'

export interface PoolUsage {
  pool: AddressMapPool
  size: number
  devices: number
  online: number
  reserved: number
}

export interface AddressBlock {
  index: number
  cidr: string
  first: number
  last: number
  counters: AddressCounters
}

export interface AddressRow<D extends AddressMapDevice = AddressMapDevice> {
  first: number
  cells: (AddressSlot<D> | null)[]
}

export interface AddressMap<D extends AddressMapDevice = AddressMapDevice> {
  cidr: string
  network: number
  broadcast: number
  prefix: number
  size: number
  counters: AddressCounters
  pools: PoolUsage[]
  blockCount: number
  slot(address: string | number): AddressSlot<D> | null
  count(first: number, last: number): AddressCounters
  nextFree(limit: number): string[]
  block(index: number): AddressBlock
  blockOf(address: string | number): AddressBlock | null
  rows(block: AddressBlock): AddressRow<D>[]
}

export const BLOCK_SIZE = 256
export const ROW_SIZE = 16

interface Interval {
  first: number
  last: number
}

interface PlacedDevice<D> {
  value: number
  device: D
}

export function addressRole(slot: Pick<AddressSlot, 'gateway' | 'pools'>): AddressRole {
  if (slot.gateway) return 'gateway'
  return slot.pools.length > 0 ? 'dhcp-client' : 'static'
}

function toValue(address: string | number): number | null {
  if (typeof address === 'number') return Number.isInteger(address) ? address : null
  try {
    return ipToNumber(address)
  } catch {
    return null
  }
}

function mergeIntervals(intervals: Interval[]): Interval[] {
  const sorted = [...intervals].sort((a, b) => a.first - b.first)
  const merged: Interval[] = []
  for (const interval of sorted) {
    const previous = merged[merged.length - 1]
    if (previous && interval.first <= previous.last + 1) {
      previous.last = Math.max(previous.last, interval.last)
    } else {
      merged.push({ ...interval })
    }
  }
  return merged
}

function poolInterval(pool: AddressMapPool, network: number, broadcast: number): Interval | null {
  const start = toValue(pool.startIp)
  const end = toValue(pool.endIp)
  if (start === null || end === null) return null
  const first = Math.max(start, network)
  const last = Math.min(end, broadcast)
  return first <= last ? { first, last } : null
}

function inIntervals(intervals: readonly Interval[], value: number): boolean {
  let low = 0
  let high = intervals.length - 1
  while (low <= high) {
    const middle = (low + high) >> 1
    const interval = intervals[middle]
    if (value < interval.first) high = middle - 1
    else if (value > interval.last) low = middle + 1
    else return true
  }
  return false
}

function overlap(intervals: readonly Interval[], first: number, last: number): number {
  let total = 0
  for (const interval of intervals) {
    const start = Math.max(interval.first, first)
    const end = Math.min(interval.last, last)
    if (start <= end) total += end - start + 1
  }
  return total
}

function lowerBound<D>(placed: readonly PlacedDevice<D>[], value: number): number {
  let low = 0
  let high = placed.length
  while (low < high) {
    const middle = (low + high) >> 1
    if (placed[middle].value < value) low = middle + 1
    else high = middle
  }
  return low
}

export function buildAddressMap<D extends AddressMapDevice>(subnet: AddressMapSubnet, devices: readonly D[]): AddressMap<D> {
  const { network, size, prefix } = parseCidr(subnet.cidr)
  const broadcast = network + size - 1
  const contains = (value: number) => value >= network && value <= broadcast

  const notUsable = new Map<number, 'network' | 'broadcast'>()
  if (!subnet.includeFirstLast) {
    notUsable.set(broadcast, 'broadcast')
    notUsable.set(network, 'network')
  }

  const gateways = new Set<number>()
  for (const gateway of subnet.gateways) {
    const value = toValue(gateway)
    if (value !== null && contains(value)) gateways.add(value)
  }

  const pools = subnet.dhcpPools.flatMap((pool) => {
    const interval = poolInterval(pool, network, broadcast)
    return interval ? [{ pool, interval }] : []
  })

  const reservedIntervals = mergeIntervals([
    ...pools.map(({ interval }) => interval),
    ...[...gateways].map((value) => ({ first: value, last: value })),
  ])

  const byValue = new Map<number, D>()
  for (const device of devices) {
    const value = toValue(device.ip)
    if (value !== null && contains(value) && !byValue.has(value)) byValue.set(value, device)
  }
  const placed: PlacedDevice<D>[] = [...byValue].map(([value, device]) => ({ value, device })).sort((a, b) => a.value - b.value)

  function count(first: number, last: number): AddressCounters {
    const from = Math.max(first, network)
    const to = Math.min(last, broadcast)
    if (from > to) return { usable: 0, occupied: 0, occupiedOnline: 0, occupiedOffline: 0, reserved: 0, free: 0 }
    let excluded = 0
    let excludedReserved = 0
    for (const value of notUsable.keys()) {
      if (value < from || value > to) continue
      excluded += 1
      if (inIntervals(reservedIntervals, value)) excludedReserved += 1
    }
    let occupiedOnline = 0
    let occupiedOffline = 0
    let occupiedReserved = 0
    for (let index = lowerBound(placed, from); index < placed.length && placed[index].value <= to; index += 1) {
      const { value, device } = placed[index]
      if (notUsable.has(value)) continue
      if (device.status === 'online') occupiedOnline += 1
      else occupiedOffline += 1
      if (inIntervals(reservedIntervals, value)) occupiedReserved += 1
    }
    const usable = to - from + 1 - excluded
    const occupied = occupiedOnline + occupiedOffline
    const reserved = overlap(reservedIntervals, from, to) - excludedReserved - occupiedReserved
    return { usable, occupied, occupiedOnline, occupiedOffline, reserved, free: usable - occupied - reserved }
  }

  function poolUsage(pool: AddressMapPool, interval: Interval): PoolUsage {
    const excluded = [...notUsable.keys()].filter((value) => value >= interval.first && value <= interval.last).length
    let devicesInPool = 0
    let online = 0
    for (let index = lowerBound(placed, interval.first); index < placed.length && placed[index].value <= interval.last; index += 1) {
      if (notUsable.has(placed[index].value)) continue
      devicesInPool += 1
      if (placed[index].device.status === 'online') online += 1
    }
    const poolSize = interval.last - interval.first + 1 - excluded
    return { pool, size: poolSize, devices: devicesInPool, online, reserved: poolSize - devicesInPool }
  }

  function slot(address: string | number): AddressSlot<D> | null {
    const value = toValue(address)
    if (value === null || !contains(value)) return null
    const kind = notUsable.get(value) ?? null
    const device = byValue.get(value) ?? null
    const gateway = gateways.has(value)
    const inPools = pools.filter(({ interval }) => value >= interval.first && value <= interval.last).map(({ pool }) => pool)
    let state: AddressState = 'free'
    if (kind) state = 'not-usable'
    else if (device) state = 'occupied'
    else if (gateway || inPools.length > 0) state = 'reserved'
    return { ip: numberToIp(value), value, state, device, gateway, pools: inPools, notUsable: kind }
  }

  function nextFree(limit: number): string[] {
    const found: string[] = []
    let intervalIndex = 0
    let value = network
    while (found.length < limit && value <= broadcast) {
      while (intervalIndex < reservedIntervals.length && reservedIntervals[intervalIndex].last < value) intervalIndex += 1
      const interval = reservedIntervals[intervalIndex]
      if (interval && value >= interval.first) {
        value = interval.last + 1
        continue
      }
      if (!notUsable.has(value) && !byValue.has(value)) found.push(numberToIp(value))
      value += 1
    }
    return found
  }

  const blockCount = Math.max(1, size / BLOCK_SIZE)

  function block(index: number): AddressBlock {
    const clamped = Math.min(Math.max(0, Math.trunc(index)), blockCount - 1)
    if (blockCount === 1) return { index: 0, cidr: subnet.cidr, first: network, last: broadcast, counters: count(network, broadcast) }
    const first = network + clamped * BLOCK_SIZE
    const last = first + BLOCK_SIZE - 1
    return { index: clamped, cidr: `${numberToIp(first)}/24`, first, last, counters: count(first, last) }
  }

  function blockOf(address: string | number): AddressBlock | null {
    const value = toValue(address)
    if (value === null || !contains(value)) return null
    return block(Math.floor((value - network) / BLOCK_SIZE))
  }

  function rows(target: AddressBlock): AddressRow<D>[] {
    const result: AddressRow<D>[] = []
    for (let first = target.first - (target.first % ROW_SIZE); first <= target.last; first += ROW_SIZE) {
      const cells = Array.from({ length: ROW_SIZE }, (_, column) => {
        const value = first + column
        return value >= target.first && value <= target.last ? slot(value) : null
      })
      result.push({ first, cells })
    }
    return result
  }

  return {
    cidr: subnet.cidr,
    network,
    broadcast,
    prefix,
    size,
    counters: count(network, broadcast),
    pools: pools.map(({ pool, interval }) => poolUsage(pool, interval)),
    blockCount,
    slot,
    count,
    nextFree,
    block,
    blockOf,
    rows,
  }
}
