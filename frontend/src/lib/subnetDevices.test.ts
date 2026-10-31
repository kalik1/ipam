import { describe, expect, it } from 'vitest'
import { buildAddressMap, type AddressMapDevice } from './addressMap'
import { deviceFilterCounts, filterDevices, selectedAddress } from './subnetDevices'

const devices: AddressMapDevice[] = [
  { id: 1, ip: '192.168.1.30', status: 'online' },
  { id: 2, ip: '192.168.1.9', status: 'offline' },
  { id: 3, ip: '192.168.1.150', status: 'online' },
  { id: 4, ip: '192.168.1.10', status: 'offline' },
]

const map = buildAddressMap(
  {
    cidr: '192.168.1.0/24',
    gateways: ['192.168.1.1'],
    includeFirstLast: false,
    dhcpPools: [{ id: 1, name: 'users', startIp: '192.168.1.100', endIp: '192.168.1.200' }],
  },
  devices,
)

describe('filterDevices', () => {
  it('sorts the devices of a subnet by IP address, not by text', () => {
    expect(filterDevices(devices, 'all', map).map((d) => d.ip)).toEqual(['192.168.1.9', '192.168.1.10', '192.168.1.30', '192.168.1.150'])
  })

  it('keeps only online, offline or DHCP pool devices', () => {
    expect(filterDevices(devices, 'online', map).map((d) => d.id)).toEqual([1, 3])
    expect(filterDevices(devices, 'offline', map).map((d) => d.id)).toEqual([2, 4])
    expect(filterDevices(devices, 'pool', map).map((d) => d.id)).toEqual([3])
  })
})

describe('selectedAddress', () => {
  it('keeps an address from the URL that lies in the subnet or belongs to one of its devices', () => {
    expect(selectedAddress('192.168.1.77', map, devices)).toBe('192.168.1.77')
    expect(selectedAddress('192.168.1.0', map, devices)).toBe('192.168.1.0')
    expect(selectedAddress('10.9.9.9', map, [...devices, { id: 9, ip: '10.9.9.9', status: 'online' }])).toBe('10.9.9.9')
  })

  it('falls back to the first device by IP when the URL has no usable address', () => {
    expect(selectedAddress(null, map, devices)).toBe('192.168.1.9')
    expect(selectedAddress('10.9.9.9', map, devices)).toBe('192.168.1.9')
    expect(selectedAddress('garbage', map, devices)).toBe('192.168.1.9')
  })

  it('falls back to the first free address of an empty subnet, then to the network address', () => {
    expect(selectedAddress(null, map, [])).toBe('192.168.1.2')
    const full = buildAddressMap({ cidr: '10.0.0.4/31', gateways: [], dhcpPools: [], includeFirstLast: false }, [])
    expect(selectedAddress(null, full, [])).toBe('10.0.0.4')
  })
})

describe('deviceFilterCounts', () => {
  it('counts the devices behind each filter', () => {
    expect(deviceFilterCounts(devices, map)).toEqual({ all: 4, online: 2, offline: 2, pool: 1 })
  })
})
