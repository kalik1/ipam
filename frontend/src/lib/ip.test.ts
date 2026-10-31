import { describe, expect, it } from 'vitest'
import { ipInCidr, ipToNumber, numberToIp, parseCidr } from './ip'

describe('ipToNumber', () => {
  it('converts an ipv4 address to a number', () => {
    expect(ipToNumber('0.0.0.0')).toBe(0)
    expect(ipToNumber('1.0.0.0')).toBe(16777216)
    expect(ipToNumber('255.255.255.255')).toBe(4294967295)
    expect(ipToNumber('192.168.1.1')).toBe(3232235777)
  })

  it('throws on invalid addresses', () => {
    expect(() => ipToNumber('1.2.3')).toThrow()
    expect(() => ipToNumber('256.0.0.1')).toThrow()
    expect(() => ipToNumber('a.b.c.d')).toThrow()
  })
})

describe('numberToIp', () => {
  it('round-trips with ipToNumber', () => {
    for (const ip of ['0.0.0.0', '10.0.0.1', '192.168.1.255', '255.255.255.255']) {
      expect(numberToIp(ipToNumber(ip))).toBe(ip)
    }
  })

  it('throws on invalid numbers', () => {
    expect(() => numberToIp(-1)).toThrow()
    expect(() => numberToIp(1.5)).toThrow()
    expect(() => numberToIp(4294967296)).toThrow()
  })
})

describe('parseCidr', () => {
  it('computes network and size', () => {
    const parsed = parseCidr('192.168.1.0/24')
    expect(parsed.network).toBe(ipToNumber('192.168.1.0'))
    expect(parsed.size).toBe(256)
    expect(parsed.prefix).toBe(24)
  })

  it('masks host bits in the base address', () => {
    const parsed = parseCidr('10.0.0.5/8')
    expect(parsed.network).toBe(ipToNumber('10.0.0.0'))
    expect(parsed.size).toBe(16777216)
  })

  it('handles /32 and /0', () => {
    expect(parseCidr('8.8.8.8/32').size).toBe(1)
    expect(parseCidr('0.0.0.0/0').size).toBe(4294967296)
  })

  it('throws on invalid cidrs', () => {
    expect(() => parseCidr('10.0.0.0')).toThrow()
    expect(() => parseCidr('10.0.0.0/33')).toThrow()
    expect(() => parseCidr('10.0.0.0/-1')).toThrow()
  })
})

describe('ipInCidr', () => {
  it('detects membership', () => {
    expect(ipInCidr('192.168.1.1', '192.168.1.0/24')).toBe(true)
    expect(ipInCidr('192.168.1.0', '192.168.1.0/24')).toBe(true)
    expect(ipInCidr('192.168.1.255', '192.168.1.0/24')).toBe(true)
    expect(ipInCidr('192.168.2.1', '192.168.1.0/24')).toBe(false)
    expect(ipInCidr('10.1.2.3', '10.0.0.0/8')).toBe(true)
  })
})
