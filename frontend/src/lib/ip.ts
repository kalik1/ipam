export function ipToNumber(ip: string): number {
  const parts = ip.split('.')
  if (parts.length !== 4) {
    throw new Error(`Invalid IP: ${ip}`)
  }
  let result = 0
  for (const part of parts) {
    const value = Number(part)
    if (!Number.isInteger(value) || value < 0 || value > 255) {
      throw new Error(`Invalid IP: ${ip}`)
    }
    result = result * 256 + value
  }
  return result
}

export function numberToIp(value: number): string {
  if (!Number.isInteger(value) || value < 0 || value > 0xffffffff) {
    throw new Error(`Invalid IP number: ${value}`)
  }
  return [
    (value >>> 24) & 255,
    (value >>> 16) & 255,
    (value >>> 8) & 255,
    value & 255,
  ].join('.')
}

export interface ParsedCidr {
  network: number
  size: number
  prefix: number
}

export function parseCidr(cidr: string): ParsedCidr {
  const [base, prefixPart] = cidr.split('/')
  const prefix = Number(prefixPart)
  if (!Number.isInteger(prefix) || prefix < 0 || prefix > 32) {
    throw new Error(`Invalid CIDR: ${cidr}`)
  }
  const network = (ipToNumber(base) & cidrMask(prefix)) >>> 0
  return { network, size: 2 ** (32 - prefix), prefix }
}

export function cidrMask(prefix: number): number {
  return prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0
}

export function ipInCidr(ip: string, cidr: string): boolean {
  const { network, size } = parseCidr(cidr)
  const value = ipToNumber(ip)
  return value >= network && value < network + size
}
