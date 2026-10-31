import { describe, expect, it } from 'vitest'
import { buildRack } from './rack'
import { buildTopologyTree, type TopologySubnetRow } from './topology'
import type { Topology, TopologyDevice, TopologySubnet, TopologyVlan } from '@/types'

let nextDeviceId = 1

function device(ip: string, status: TopologyDevice['status'] = 'online'): TopologyDevice {
  const id = nextDeviceId++
  return { id, ip, hostname: `host-${id}`, status, lastSeen: '2026-10-31T10:00:00Z' }
}

function subnet(id: number, cidr: string, devices: TopologyDevice[], gateways: string[] = []): TopologySubnet {
  return { id, cidr, name: `Subnet ${id}`, gateways, used: devices.length, total: 0, percent: 0, devices }
}

function vlan(tag: number | null, subnets: TopologySubnet[], name = `vlan-${tag}`): TopologyVlan {
  return { id: tag === null ? null : tag * 100, vlanId: tag, name: tag === null ? 'Unassigned' : name, description: '', subnets }
}

function row(id: number, cidr: string, extra: Partial<TopologySubnetRow> = {}): TopologySubnetRow {
  return { id, cidr, gateways: [], dhcpPools: [], includeFirstLast: false, ...extra }
}

function rackOf(vlans: TopologyVlan[], rows: TopologySubnetRow[] = []) {
  const topology: Topology = { vlans }
  return buildRack(buildTopologyTree(topology, rows))
}

const servers = { id: 2, name: 'servers', startIp: '192.168.1.10', endIp: '192.168.1.20' }
const users = { id: 1, name: 'users', startIp: '192.168.1.100', endIp: '192.168.1.200' }

describe('buildRack rows', () => {
  it('gives a /24 one cell per address, with devices winning over gateway and DHCP pool', () => {
    const gateways = ['192.168.1.1', '192.168.1.2']
    const lan = subnet(3, '192.168.1.0/24', [device('192.168.1.10'), device('192.168.1.20', 'offline'), device('192.168.1.50')], gateways)
    const rack = rackOf([vlan(20, [lan], 'Users')], [row(3, '192.168.1.0/24', { gateways, dhcpPools: [users, servers] })])

    const [unit] = rack.rows
    expect(unit).toMatchObject({ id: 3, name: 'Subnet 3', cidr: '192.168.1.0/24', href: '/subnets/3', color: '#EE8A2E', vlanLabel: 'VLAN 20, Users' })
    expect(unit.counters).toEqual({ usable: 254, occupied: 3, occupiedOnline: 2, occupiedOffline: 1, reserved: 112, free: 139 })
    expect(unit.cells).toHaveLength(256)
    expect([0, 1, 2, 3, 10, 11, 20, 50, 100, 200, 201, 255].map((index) => unit.cells[index])).toEqual([
      'na',
      'res',
      'res',
      'free',
      'on',
      'res',
      'off',
      'on',
      'res',
      'res',
      'free',
      'na',
    ])
  })

  it('draws the network and broadcast of a /30 as not usable unless the subnet includes them', () => {
    const included = subnet(1, '10.0.1.0/30', [device('10.0.1.2'), device('10.0.1.3')], ['10.0.1.1'])
    const excluded = subnet(2, '10.0.2.0/30', [device('10.0.2.3')], ['10.0.2.1'])
    const rack = rackOf(
      [vlan(10, [included, excluded])],
      [row(1, '10.0.1.0/30', { gateways: ['10.0.1.1'], includeFirstLast: true }), row(2, '10.0.2.0/30', { gateways: ['10.0.2.1'] })],
    )

    expect(rack.rows.map((unit) => unit.cells)).toEqual([
      ['free', 'res', 'on', 'on'],
      ['na', 'res', 'free', 'na'],
    ])
    expect(rack.rows[1].counters).toMatchObject({ usable: 2, occupied: 0, reserved: 1, free: 1 })
  })

  it('gives a /32 that does not include it a single not usable cell', () => {
    const rack = rackOf([vlan(null, [subnet(4, '10.9.9.9/32', [])])])

    expect(rack.rows[0]).toMatchObject({ cells: ['na'], color: '#7A8591', vlanLabel: 'No VLAN' })
  })

  it('groups the addresses of a subnet larger than /24 into 256 cells, an online device winning over an offline one', () => {
    const servers16 = subnet(5, '172.16.0.0/16', [
      device('172.16.5.7', 'offline'),
      device('172.16.5.100'),
      device('172.16.9.1', 'offline'),
      device('172.16.255.255'),
    ])
    const pool = { id: 3, name: 'lab', startIp: '172.16.20.0', endIp: '172.16.20.10' }
    const rack = rackOf([vlan(30, [servers16])], [row(5, '172.16.0.0/16', { dhcpPools: [pool] })])

    const { cells } = rack.rows[0]
    expect(cells).toHaveLength(256)
    expect([0, 5, 9, 20, 21, 255].map((index) => cells[index])).toEqual(['free', 'on', 'off', 'res', 'free', 'free'])
    expect(cells.filter((cell) => cell === 'free')).toHaveLength(253)
  })
})

describe('buildRack summary', () => {
  it('adds up the counters of every row and counts the subnets low on free addresses', () => {
    const rack = rackOf([
      vlan(10, [subnet(1, '10.0.1.0/30', [device('10.0.1.1'), device('10.0.1.2', 'offline')]), subnet(2, '10.0.2.0/29', [device('10.0.2.1')], ['10.0.2.6'])]),
      vlan(20, []),
      vlan(null, [subnet(3, '10.0.3.0/24', [device('10.0.3.9', 'offline')])]),
    ])

    expect(rack.summary).toEqual({
      counters: { usable: 262, occupied: 4, occupiedOnline: 2, occupiedOffline: 2, reserved: 1, free: 257 },
      freePercent: 98,
      low: 1,
      subnets: 3,
      vlans: 2,
    })
  })

  it('lists the cable color of every VLAN that has a row in the rack, the No VLAN cable included', () => {
    const rack = rackOf([vlan(10, [subnet(1, '10.0.1.0/24', [])], 'Management'), vlan(20, []), vlan(null, [subnet(3, '10.0.3.0/24', [])])])

    expect(rack.vlans).toEqual([
      { key: '1000', label: 'VLAN 10, Management', color: '#2FB874' },
      { key: 'none', label: 'No VLAN', color: '#7A8591' },
    ])
  })
})

function hosts(prefix: string, first: number, count: number): TopologyDevice[] {
  return Array.from({ length: count }, (_, index) => device(`${prefix}.${first + index}`))
}

describe('buildRack free addresses', () => {
  it('flags a subnet under 10% free and never rounds its percentage up to 10', () => {
    const rack = rackOf([
      vlan(10, [
        subnet(1, '10.1.0.0/24', hosts('10.1.0', 1, 229)),
        subnet(2, '10.2.0.0/24', hosts('10.2.0', 1, 228)),
        subnet(3, '10.3.0.0/28', hosts('10.3.0', 1, 13)),
      ]),
    ])

    expect(rack.rows.map(({ counters, freePercent, low }) => ({ free: counters.free, freePercent, low }))).toEqual([
      { free: 25, freePercent: 9, low: true },
      { free: 26, freePercent: 10, low: false },
      { free: 1, freePercent: 7, low: true },
    ])
  })

  it('does not flag a subnet without usable addresses', () => {
    const rack = rackOf([vlan(null, [subnet(4, '10.9.9.9/32', [])])])

    expect(rack.rows[0]).toMatchObject({ freePercent: 0, low: false })
  })

  it('counts the DHCP pools of a subnet and their addresses', () => {
    const rack = rackOf(
      [vlan(20, [subnet(3, '192.168.1.0/24', []), subnet(6, '192.168.2.0/24', [])])],
      [row(3, '192.168.1.0/24', { dhcpPools: [users, servers] })],
    )

    expect(rack.rows.map(({ pools }) => pools)).toEqual([
      { count: 2, size: 112 },
      { count: 0, size: 0 },
    ])
  })
})
