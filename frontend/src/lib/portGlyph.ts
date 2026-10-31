import type { AddressMapDevice, AddressSlot, AddressState } from './addressMap'
import { cx } from './cx'

export type StateClass = 'occ' | 'res' | 'free' | 'na'
export type LinkClass = 'on' | 'off'

export const STATE_CLASS = {
  occupied: 'occ',
  reserved: 'res',
  free: 'free',
  'not-usable': 'na',
} as const satisfies Record<AddressState, StateClass>

export function linkClass(status: AddressMapDevice['status']): LinkClass {
  return status === 'online' ? 'on' : 'off'
}

const STATE_LABEL: Record<AddressState, string> = {
  occupied: 'Occupied',
  reserved: 'Reserved',
  free: 'Free',
  'not-usable': 'Not usable',
}

export function stateLabel(state: AddressState): string {
  return STATE_LABEL[state]
}

export function portClass(slot: AddressSlot): string {
  const link = slot.state === 'occupied' && slot.device ? linkClass(slot.device.status) : null
  return cx('port', `k-${STATE_CLASS[slot.state]}`, link, slot.pools.length > 0 && 'inpool', slot.gateway && 'isgw')
}

export const UNNAMED_DEVICE = 'Unnamed device'

export function deviceName(device: { hostname?: string }): string {
  return device.hostname?.trim() || UNNAMED_DEVICE
}

export function portDescription(slot: AddressSlot<AddressMapDevice & { hostname?: string }>): string {
  if (slot.state === 'occupied' && slot.device) return `${slot.ip}, ${deviceName(slot.device)}, ${slot.device.status}`
  if (slot.state === 'not-usable') return `${slot.ip}, ${slot.notUsable} address, not usable`
  if (slot.state === 'reserved') return `${slot.ip}, reserved for ${slot.gateway ? 'the gateway' : 'DHCP'}`
  return `${slot.ip}, free`
}
