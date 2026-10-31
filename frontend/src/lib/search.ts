import type { Device, Subnet } from '@/types'
import { ipToNumber } from './ip'

export interface SearchableDevice extends Pick<Device, 'id' | 'ip' | 'mac' | 'hostname' | 'status'> {
  subnet: Pick<Subnet, 'id' | 'name' | 'cidr'> | null
}

function compactMac(value: string): string {
  return value.toLowerCase().replace(/[\s:.-]/g, '')
}

function looksLikeIp(term: string): boolean {
  return term.split('.').every((group) => /^\d{0,3}$/.test(group))
}

const NO_MATCH = Number.POSITIVE_INFINITY

function rank(value: string, term: string): number {
  if (!value || !value.includes(term)) return NO_MATCH
  if (value === term) return 0
  return value.startsWith(term) ? 1 : 2
}

function addressOrder(ip: string): number {
  try {
    return ipToNumber(ip)
  } catch {
    return NO_MATCH
  }
}

export function matchDevices<T extends SearchableDevice>(devices: T[], query: string): T[] {
  const term = query.trim().toLowerCase()
  if (!term) return []
  const macTerm = compactMac(term)
  const macSearch = /^[0-9a-f]+$/.test(macTerm) && !looksLikeIp(term)
  return devices
    .map((device) => ({
      device,
      score: Math.min(
        rank(device.ip, term),
        rank(device.hostname.toLowerCase(), term),
        macSearch ? rank(compactMac(device.mac), macTerm) : NO_MATCH,
      ),
    }))
    .filter((entry) => entry.score !== NO_MATCH)
    .sort((a, b) => a.score - b.score || addressOrder(a.device.ip) - addressOrder(b.device.ip))
    .map(({ device }) => device)
}

export function stepIndex(current: number, delta: 1 | -1, count: number): number {
  if (count === 0) return -1
  if (current < 0) return delta > 0 ? 0 : count - 1
  return (current + delta + count) % count
}

export interface FocusTarget {
  tagName: string
  isContentEditable?: boolean
}

const TYPING_TAGS = new Set(['INPUT', 'TEXTAREA', 'SELECT'])

export function isTypingTarget(target: FocusTarget | null): boolean {
  if (!target) return false
  return Boolean(target.isContentEditable) || TYPING_TAGS.has(target.tagName.toUpperCase())
}

export interface ShortcutEvent {
  key: string
  ctrlKey: boolean
  metaKey: boolean
  altKey: boolean
  isComposing?: boolean
  defaultPrevented?: boolean
}

export function isSearchShortcut(event: ShortcutEvent, focused: FocusTarget | null): boolean {
  if (event.key !== '/' || event.isComposing || event.defaultPrevented) return false
  if (event.ctrlKey || event.metaKey || event.altKey) return false
  return !isTypingTarget(focused)
}

export function resultPath(device: SearchableDevice): string {
  if (!device.subnet) return '/devices'
  return `/subnets/${device.subnet.id}?${new URLSearchParams({ ip: device.ip })}`
}
