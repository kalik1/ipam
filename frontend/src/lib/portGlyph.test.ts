import { describe, expect, it } from 'vitest'
import { buildAddressMap } from './addressMap'
import { deviceName, portClass, portDescription } from './portGlyph'

const map = buildAddressMap(
  {
    cidr: '10.0.20.0/24',
    gateways: ['10.0.20.1'],
    includeFirstLast: false,
    dhcpPools: [{ id: 1, name: 'clients', startIp: '10.0.20.100', endIp: '10.0.20.199' }],
  },
  [
    { id: 1, ip: '10.0.20.1', status: 'online', hostname: 'gw-office' },
    { id: 2, ip: '10.0.20.150', status: 'offline', hostname: '' },
  ],
)

describe('portClass', () => {
  it('gives each state its glyph and adds link, pool and gateway marks', () => {
    expect(portClass(map.slot('10.0.20.1')!)).toBe('port k-occ on isgw')
    expect(portClass(map.slot('10.0.20.150')!)).toBe('port k-occ off inpool')
    expect(portClass(map.slot('10.0.20.120')!)).toBe('port k-res inpool')
    expect(portClass(map.slot('10.0.20.5')!)).toBe('port k-free')
    expect(portClass(map.slot('10.0.20.0')!)).toBe('port k-na')
  })
})

describe('portDescription', () => {
  it('describes a port for screen readers and tooltips', () => {
    expect(portDescription(map.slot('10.0.20.1')!)).toBe('10.0.20.1, gw-office, online')
    expect(portDescription(map.slot('10.0.20.150')!)).toBe('10.0.20.150, Unnamed device, offline')
    expect(portDescription(map.slot('10.0.20.120')!)).toBe('10.0.20.120, reserved for DHCP')
    expect(portDescription(map.slot('10.0.20.5')!)).toBe('10.0.20.5, free')
    expect(portDescription(map.slot('10.0.20.255')!)).toBe('10.0.20.255, broadcast address, not usable')
  })
})

describe('deviceName', () => {
  it('names a device by its trimmed hostname', () => {
    expect(deviceName({ hostname: '  printer-4f ' })).toBe('printer-4f')
  })

  it('calls a device without a hostname an unnamed device, in sentence case', () => {
    expect(deviceName({ hostname: '   ' })).toBe('Unnamed device')
    expect(deviceName({})).toBe('Unnamed device')
  })
})
