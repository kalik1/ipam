import { describe, expect, it } from 'vitest'
import { addressRole, buildAddressMap, type AddressMapDevice, type AddressMapSubnet } from './addressMap'

function subnet(cidr: string, overrides: Partial<AddressMapSubnet> = {}): AddressMapSubnet {
  return { cidr, gateways: [], dhcpPools: [], includeFirstLast: false, ...overrides }
}

function device(id: number, ip: string, status: AddressMapDevice['status'] = 'online'): AddressMapDevice {
  return { id, ip, status }
}

describe('buildAddressMap', () => {
  it('treats every usable address of an empty /24 as Free and its network and broadcast as Not usable', () => {
    const map = buildAddressMap(subnet('10.0.20.0/24'), [])

    expect(map.counters).toEqual({ usable: 254, occupied: 0, occupiedOnline: 0, occupiedOffline: 0, reserved: 0, free: 254 })
    expect(map.slot('10.0.20.0')?.state).toBe('not-usable')
    expect(map.slot('10.0.20.0')?.notUsable).toBe('network')
    expect(map.slot('10.0.20.255')?.notUsable).toBe('broadcast')
    expect(map.slot('10.0.20.1')?.state).toBe('free')
    expect(map.slot('10.0.20.254')?.state).toBe('free')
    expect(map.slot('10.0.21.1')).toBeNull()
  })

  it('marks a gateway without a device as Reserved and a gateway with a device as Occupied', () => {
    const router = device(1, '10.0.20.1')
    const map = buildAddressMap(subnet('10.0.20.0/24', { gateways: ['10.0.20.1', '10.0.20.2'] }), [router])

    expect(map.slot('10.0.20.1')).toMatchObject({ state: 'occupied', device: router, gateway: true })
    expect(map.slot('10.0.20.2')).toMatchObject({ state: 'reserved', device: null, gateway: true })
    expect(map.slot('10.0.20.3')).toMatchObject({ state: 'free', gateway: false })
  })

  it('marks a DHCP pool address with a device as Occupied and the rest of the pool as Reserved', () => {
    const pool = { id: 7, name: 'clients', startIp: '10.0.20.100', endIp: '10.0.20.199' }
    const laptop = device(4, '10.0.20.150', 'offline')
    const map = buildAddressMap(subnet('10.0.20.0/24', { dhcpPools: [pool] }), [laptop])

    expect(map.slot('10.0.20.150')).toMatchObject({ state: 'occupied', device: laptop, pools: [pool] })
    expect(map.slot('10.0.20.100')).toMatchObject({ state: 'reserved', pools: [pool] })
    expect(map.slot('10.0.20.199')).toMatchObject({ state: 'reserved', pools: [pool] })
    expect(map.slot('10.0.20.200')).toMatchObject({ state: 'free', pools: [] })
  })

  it('counts Occupied online, Occupied offline, Reserved and Free so that they add up to the usable addresses', () => {
    const map = buildAddressMap(
      subnet('192.168.1.0/24', {
        gateways: ['192.168.1.1', '192.168.1.2'],
        dhcpPools: [
          { id: 1, name: 'users', startIp: '192.168.1.100', endIp: '192.168.1.200' },
          { id: 2, name: 'servers', startIp: '192.168.1.10', endIp: '192.168.1.20' },
        ],
      }),
      [device(1, '192.168.1.10'), device(2, '192.168.1.20', 'offline'), device(3, '192.168.1.30')],
    )

    expect(map.counters).toEqual({ usable: 254, occupied: 3, occupiedOnline: 2, occupiedOffline: 1, reserved: 112, free: 139 })
  })

  it('counts an address covered by overlapping pools and a gateway once', () => {
    const map = buildAddressMap(
      subnet('10.0.20.0/24', {
        gateways: ['10.0.20.105'],
        dhcpPools: [
          { id: 1, name: 'a', startIp: '10.0.20.100', endIp: '10.0.20.109' },
          { id: 2, name: 'b', startIp: '10.0.20.105', endIp: '10.0.20.114' },
        ],
      }),
      [],
    )

    expect(map.counters.reserved).toBe(15)
    expect(map.slot('10.0.20.105')?.pools.map((p) => p.name)).toEqual(['a', 'b'])
  })

  it('makes network and broadcast ordinary addresses when the subnet includes them', () => {
    const map = buildAddressMap(subnet('10.0.1.0/30', { includeFirstLast: true, gateways: ['10.0.1.1'] }), [
      device(1, '10.0.1.2'),
      device(2, '10.0.1.3'),
    ])

    expect(map.counters).toEqual({ usable: 4, occupied: 2, occupiedOnline: 2, occupiedOffline: 0, reserved: 1, free: 1 })
    expect(map.slot('10.0.1.0')).toMatchObject({ state: 'free', notUsable: null })
    expect(map.slot('10.0.1.3')?.state).toBe('occupied')
  })

  it('keeps a device recorded on the network or broadcast address out of the counters', () => {
    const map = buildAddressMap(subnet('10.0.20.0/24'), [device(1, '10.0.20.255'), device(2, '10.0.20.7')])

    expect(map.slot('10.0.20.255')).toMatchObject({ state: 'not-usable', device: { id: 1 } })
    expect(map.counters).toMatchObject({ usable: 254, occupied: 1, free: 253 })
  })

  it('ignores devices whose IP is outside the subnet or invalid', () => {
    const map = buildAddressMap(subnet('10.0.20.0/24'), [device(1, '10.0.21.5'), device(2, 'not-an-ip'), device(3, '10.0.20.9')])

    expect(map.counters.occupied).toBe(1)
  })

  it.each([
    ['10.0.20.128/25', false, 126, '10.0.20.128', '10.0.20.255'],
    ['10.0.20.4/30', false, 2, '10.0.20.4', '10.0.20.7'],
    ['10.0.20.4/31', false, 0, '10.0.20.4', '10.0.20.5'],
    ['10.0.20.4/31', true, 2, '10.0.20.4', '10.0.20.5'],
    ['10.0.20.9/32', false, 0, '10.0.20.9', '10.0.20.9'],
    ['10.0.20.9/32', true, 1, '10.0.20.9', '10.0.20.9'],
  ])('gives %s (include first and last: %s) %i usable addresses between %s and %s', (cidr, includeFirstLast, usable, first, last) => {
    const map = buildAddressMap(subnet(cidr, { includeFirstLast }), [])

    expect(map.counters).toEqual({ usable, occupied: 0, occupiedOnline: 0, occupiedOffline: 0, reserved: 0, free: usable })
    expect(map.slot(first)).not.toBeNull()
    expect(map.slot(last)).not.toBeNull()
    expect(map.slot(first)?.state).toBe(includeFirstLast ? 'free' : 'not-usable')
  })
})

describe('nextFree', () => {
  it('lists Free addresses in order, skipping Reserved and Occupied ones', () => {
    const map = buildAddressMap(
      subnet('10.0.20.0/24', {
        gateways: ['10.0.20.1'],
        dhcpPools: [{ id: 1, name: 'p', startIp: '10.0.20.3', endIp: '10.0.20.5' }],
      }),
      [device(1, '10.0.20.2'), device(2, '10.0.20.7', 'offline')],
    )

    expect(map.nextFree(4)).toEqual(['10.0.20.6', '10.0.20.8', '10.0.20.9', '10.0.20.10'])
  })

  it('never offers the network or broadcast address and stops at the end of the subnet', () => {
    const map = buildAddressMap(subnet('10.0.20.4/30', { gateways: ['10.0.20.5'] }), [])

    expect(map.nextFree(12)).toEqual(['10.0.20.6'])
    expect(buildAddressMap(subnet('10.0.20.4/31'), []).nextFree(12)).toEqual([])
  })

  it('jumps over a large pool quickly', () => {
    const map = buildAddressMap(
      subnet('10.0.0.0/8', { dhcpPools: [{ id: 1, name: 'all', startIp: '10.0.0.1', endIp: '10.255.255.200' }] }),
      [],
    )

    expect(map.nextFree(2)).toEqual(['10.255.255.201', '10.255.255.202'])
  })
})

describe('blocks', () => {
  it('splits a /22 into four /24 blocks, with network and broadcast only in the first and last', () => {
    const map = buildAddressMap(subnet('172.16.4.0/22'), [device(1, '172.16.6.20')])

    expect(map.blockCount).toBe(4)
    expect(map.block(2)).toMatchObject({ index: 2, cidr: '172.16.6.0/24' })
    expect(map.blockOf('172.16.7.9')?.index).toBe(3)
    expect(map.blockOf('172.16.8.1')).toBeNull()
    expect([0, 1, 2, 3].map((index) => map.block(index).counters.usable)).toEqual([255, 256, 256, 255])
    expect(map.block(2).counters.occupied).toBe(1)
    expect(map.counters.usable).toBe(1022)
  })

  it('keeps a /24 or smaller subnet in a single block', () => {
    const map = buildAddressMap(subnet('10.0.20.64/26'), [])

    expect(map.blockCount).toBe(1)
    expect(map.block(0)).toMatchObject({ index: 0, cidr: '10.0.20.64/26' })
    expect(map.blockOf('10.0.20.70')?.index).toBe(0)
  })
})

describe('rows', () => {
  it('lays a /24 out in 16 rows of 16 addresses aligned to the last octet', () => {
    const map = buildAddressMap(subnet('10.0.20.0/24'), [])
    const rows = map.rows(map.block(0))

    expect(rows).toHaveLength(16)
    expect(rows[1].cells.map((cell) => cell?.ip)).toEqual(Array.from({ length: 16 }, (_, column) => `10.0.20.${16 + column}`))
    expect(rows[15].cells[15]?.notUsable).toBe('broadcast')
  })

  it('puts a /30 on one row in the columns of its last octet, leaving the other columns empty', () => {
    const map = buildAddressMap(subnet('10.0.20.4/30'), [])
    const [row, ...rest] = map.rows(map.block(0))

    expect(rest).toHaveLength(0)
    expect(row.first).toBe(map.network - 4)
    expect(row.cells.map((cell) => cell?.ip ?? null)).toEqual([
      null, null, null, null, '10.0.20.4', '10.0.20.5', '10.0.20.6', '10.0.20.7',
      null, null, null, null, null, null, null, null,
    ])
  })

  it('shows only the selected /24 block of a larger subnet', () => {
    const map = buildAddressMap(subnet('172.16.0.0/16'), [])
    const rows = map.rows(map.block(5))

    expect(rows).toHaveLength(16)
    expect(rows[0].cells[0]?.ip).toBe('172.16.5.0')
    expect(rows[0].cells[0]?.state).toBe('free')
    expect(rows[15].cells[15]?.ip).toBe('172.16.5.255')
  })
})

describe('count', () => {
  it('summarizes any range of addresses, for miniature maps that aggregate several addresses per cell', () => {
    const map = buildAddressMap(
      subnet('10.0.20.0/24', { dhcpPools: [{ id: 1, name: 'p', startIp: '10.0.20.100', endIp: '10.0.20.199' }] }),
      [device(1, '10.0.20.105')],
    )
    const first = map.network + 96

    expect(map.count(first, first + 15)).toEqual({ usable: 16, occupied: 1, occupiedOnline: 1, occupiedOffline: 0, reserved: 11, free: 4 })
    expect(map.count(map.network, map.network + 3)).toMatchObject({ usable: 3, free: 3 })
    expect(map.count(map.broadcast + 1, map.broadcast + 20).usable).toBe(0)
  })
})

describe('pools', () => {
  it('reports per DHCP pool its size, the devices seen in it and how many addresses stay reserved', () => {
    const users = { id: 1, name: 'users', startIp: '192.168.1.100', endIp: '192.168.1.200' }
    const servers = { id: 2, name: 'servers', startIp: '192.168.1.10', endIp: '192.168.1.20' }
    const map = buildAddressMap(subnet('192.168.1.0/24', { dhcpPools: [users, servers] }), [
      device(1, '192.168.1.10'),
      device(2, '192.168.1.20', 'offline'),
      device(3, '192.168.1.30'),
    ])

    expect(map.pools).toEqual([
      { pool: users, size: 101, devices: 0, online: 0, reserved: 101 },
      { pool: servers, size: 11, devices: 2, online: 1, reserved: 9 },
    ])
  })
})

describe('addressRole', () => {
  it('calls an address a gateway first, then a DHCP client inside a pool, otherwise a static address', () => {
    const pool = { id: 1, name: 'p', startIp: '10.0.20.1', endIp: '10.0.20.9' }
    const map = buildAddressMap(subnet('10.0.20.0/24', { gateways: ['10.0.20.1'], dhcpPools: [pool] }), [])

    expect(addressRole(map.slot('10.0.20.1')!)).toBe('gateway')
    expect(addressRole(map.slot('10.0.20.5')!)).toBe('dhcp-client')
    expect(addressRole(map.slot('10.0.20.50')!)).toBe('static')
  })
})
