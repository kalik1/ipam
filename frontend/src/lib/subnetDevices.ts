import type { AddressMap, AddressMapDevice } from './addressMap'
import { ipToNumber, numberToIp } from './ip'

export type DeviceFilter = 'all' | 'online' | 'offline' | 'pool'

function ipOrder(ip: string): number {
  try {
    return ipToNumber(ip)
  } catch {
    return Number.MAX_SAFE_INTEGER
  }
}

function matches<D extends AddressMapDevice>(device: D, filter: DeviceFilter, map: AddressMap<D>): boolean {
  if (filter === 'online' || filter === 'offline') return device.status === filter
  if (filter === 'pool') return (map.slot(device.ip)?.pools.length ?? 0) > 0
  return true
}

export function filterDevices<D extends AddressMapDevice>(devices: readonly D[], filter: DeviceFilter, map: AddressMap<D>): D[] {
  return devices.filter((device) => matches(device, filter, map)).sort((a, b) => ipOrder(a.ip) - ipOrder(b.ip))
}

export function selectedAddress<D extends AddressMapDevice>(requested: string | null, map: AddressMap<D>, devices: readonly D[]): string {
  if (requested && (map.slot(requested) || devices.some((device) => device.ip === requested))) return requested
  const firstDevice = filterDevices(devices, 'all', map).find((device) => map.slot(device.ip)?.state === 'occupied')
  if (firstDevice) return firstDevice.ip
  return map.nextFree(1)[0] ?? numberToIp(map.network)
}

export function deviceFilterCounts<D extends AddressMapDevice>(devices: readonly D[], map: AddressMap<D>): Record<DeviceFilter, number> {
  const count = (filter: DeviceFilter) => devices.filter((device) => matches(device, filter, map)).length
  return { all: devices.length, online: count('online'), offline: count('offline'), pool: count('pool') }
}
