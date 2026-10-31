import { cidrMask, ipToNumber, numberToIp, parseCidr } from './ip'

export interface SubnetFacts {
  network: string
  broadcast: string
  netmask: string
  wildcard: string
  firstUsable: string | null
  lastUsable: string | null
  usable: number
  reverseZone: string
  size: number
}

export interface AddressMath {
  networkBits: string
  hostBits: string
  hex: string
  decimal: string
  ptr: string
  hostNumber: number | null
  usable: number
}

interface UsableRange {
  first: number
  last: number
  count: number
}

function octets(value: number): number[] {
  return numberToIp(value).split('.').map(Number)
}

function usableRange(network: number, size: number, includeFirstLast: boolean): UsableRange | null {
  if (includeFirstLast) return { first: network, last: network + size - 1, count: size }
  if (size <= 2) return null
  return { first: network + 1, last: network + size - 2, count: size - 2 }
}

function reverseZone(network: number, prefix: number): string {
  const parts = octets(network)
  const full = Math.min(3, Math.floor(prefix / 8))
  const labels = parts.slice(0, full).reverse().map(String)
  if (prefix < 24 && prefix % 8 !== 0) {
    const low = parts[full]
    const high = low + 2 ** (8 - (prefix % 8)) - 1
    labels.unshift(`${low}-${high}`)
  }
  return [...labels, 'in-addr.arpa'].join('.')
}

export function subnetFacts(cidr: string, includeFirstLast: boolean): SubnetFacts {
  const { network, size, prefix } = parseCidr(cidr)
  const mask = cidrMask(prefix)
  const range = usableRange(network, size, includeFirstLast)
  return {
    network: numberToIp(network),
    broadcast: numberToIp(network + size - 1),
    netmask: numberToIp(mask),
    wildcard: numberToIp(~mask >>> 0),
    firstUsable: range ? numberToIp(range.first) : null,
    lastUsable: range ? numberToIp(range.last) : null,
    usable: range?.count ?? 0,
    reverseZone: reverseZone(network, prefix),
    size,
  }
}

function binary(value: number): string {
  return octets(value)
    .map((part) => part.toString(2).padStart(8, '0'))
    .join('.')
}

function splitBinary(value: number, prefix: number): { networkBits: string; hostBits: string } {
  const bits = binary(value)
  const cut = prefix + Math.floor(prefix / 8)
  return { networkBits: bits.slice(0, cut), hostBits: bits.slice(cut) }
}

export function addressMath(ip: string, cidr: string, includeFirstLast: boolean): AddressMath {
  const value = ipToNumber(ip)
  const { network, size, prefix } = parseCidr(cidr)
  const range = usableRange(network, size, includeFirstLast)
  const usable = range !== null && value >= range.first && value <= range.last
  return {
    ...splitBinary(value, prefix),
    hex: `0x${value.toString(16).toUpperCase().padStart(8, '0')}`,
    decimal: String(value),
    ptr: [...octets(value).reverse(), 'in-addr.arpa'].join('.'),
    hostNumber: usable ? value - range.first + 1 : null,
    usable: range?.count ?? 0,
  }
}

export function formatRange(first: string, last: string): string {
  const head = first.slice(0, first.lastIndexOf('.') + 1)
  if (last.startsWith(head)) return `${first} to .${last.slice(head.length)}`
  return `${first} to ${last}`
}

export function splitIp(ip: string, prefix: number): { network: string; host: string } {
  const parts = ip.split('.')
  const networkOctets = Math.min(3, Math.floor(prefix / 8))
  const network = parts.slice(0, networkOctets).join('.')
  return { network: network ? `${network}.` : '', host: parts.slice(networkOctets).join('.') }
}

const COLON_OR_DASH_MAC = /^[0-9a-f]{2}([:-])[0-9a-f]{2}(\1[0-9a-f]{2}){4}$/i
const DOTTED_MAC = /^[0-9a-f]{4}\.[0-9a-f]{4}\.[0-9a-f]{4}$/i
const BARE_MAC = /^[0-9a-f]{12}$/i

export function splitMac(mac: string): { oui: string; nic: string } {
  const value = mac.trim()
  if (COLON_OR_DASH_MAC.test(value)) return { oui: value.slice(0, 9), nic: value.slice(9) }
  if (DOTTED_MAC.test(value)) return { oui: value.slice(0, 7), nic: value.slice(7) }
  if (BARE_MAC.test(value)) return { oui: value.slice(0, 6), nic: value.slice(6) }
  return { oui: '', nic: value }
}
