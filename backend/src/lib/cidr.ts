export interface ParsedCidr {
  network: number;
  mask: number;
  size: number;
  broadcast: number;
}

export function isValidIp(ip: string): boolean {
  const parts = ip.split('.');
  if (parts.length !== 4) return false;
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) return false;
    if (part.length > 1 && part.startsWith('0')) return false;
    if (Number(part) > 255) return false;
  }
  return true;
}

export function ipToNumber(ip: string): number {
  if (!isValidIp(ip)) throw new Error(`Invalid IP address: ${ip}`);
  return ip.split('.').reduce((acc, part) => acc * 256 + Number(part), 0);
}

export function numberToIp(n: number): string {
  if (!Number.isInteger(n) || n < 0 || n > 0xffffffff) {
    throw new Error(`Invalid IP number: ${n}`);
  }
  return [
    (n >>> 24) & 255,
    (n >>> 16) & 255,
    (n >>> 8) & 255,
    n & 255,
  ].join('.');
}

export function isValidCidr(cidr: string): boolean {
  const match = /^(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})\/(\d{1,2})$/.exec(cidr);
  if (!match) return false;
  return Number(match[2]) <= 32 && isValidIp(match[1]);
}

function maskBits(mask: number): number {
  return mask === 0 ? 0 : (0xffffffff << (32 - mask)) >>> 0;
}

export function parseCidr(cidr: string): ParsedCidr {
  if (!isValidCidr(cidr)) throw new Error(`Invalid CIDR: ${cidr}`);
  const [ipPart, maskPart] = cidr.split('/');
  const mask = Number(maskPart);
  const size = 2 ** (32 - mask);
  const network = (ipToNumber(ipPart) & maskBits(mask)) >>> 0;
  return { network, mask, size, broadcast: network + size - 1 };
}

export function cidrContains(cidr: string, ip: string): boolean {
  const { network, mask } = parseCidr(cidr);
  return (ipToNumber(ip) & maskBits(mask)) >>> 0 === network;
}

export function totalHosts(cidr: string, includeFirstLast = false): number {
  const { mask, size } = parseCidr(cidr);
  if (includeFirstLast) return size;
  if (mask >= 31) return 0;
  return size - 2;
}

export function isNetworkOrBroadcast(cidr: string, ip: string): boolean {
  const { network, broadcast } = parseCidr(cidr);
  const n = ipToNumber(ip);
  return n === network || n === broadcast;
}
