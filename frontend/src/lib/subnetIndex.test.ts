import { describe, expect, it } from 'vitest'
import type { AddressMapDevice } from './addressMap'
import { groupSubnetsByVlan, type IndexableSubnet } from './subnetIndex'

function subnet(overrides: Partial<IndexableSubnet> & Pick<IndexableSubnet, 'id' | 'cidr'>): IndexableSubnet {
  return { name: `Subnet ${overrides.id}`, vlan: null, gateways: [], dhcpPools: [], includeFirstLast: false, ...overrides }
}

function online(id: number, ip: string): AddressMapDevice {
  return { id, ip, status: 'online' }
}

const management = { vlanId: 10, name: 'Management' }
const users = { vlanId: 20, name: 'Users' }
const NO_DEVICES = new Map<number, AddressMapDevice[]>()

describe('groupSubnetsByVlan', () => {
  it('lists each subnet under its VLAN with the VLAN cable color, VLANs by ID', () => {
    const groups = groupSubnetsByVlan(
      [
        subnet({ id: 1, cidr: '192.168.1.0/24', name: 'Users LAN', vlan: users }),
        subnet({ id: 2, cidr: '10.0.0.0/24', name: 'Management LAN', vlan: management }),
      ],
      NO_DEVICES,
    )

    expect(groups.map((g) => [g.label, g.color, g.subnets.map((s) => s.name)])).toEqual([
      ['VLAN 10, Management', '#2FB874', ['Management LAN']],
      ['VLAN 20, Users', '#EE8A2E', ['Users LAN']],
    ])
  })

  it('puts subnets without a VLAN in a gray group after every VLAN', () => {
    const groups = groupSubnetsByVlan(
      [subnet({ id: 1, cidr: '172.31.0.0/24', name: 'Lab' }), subnet({ id: 2, cidr: '10.0.0.0/24', name: 'Management LAN', vlan: management })],
      NO_DEVICES,
    )

    expect(groups.map((g) => [g.tag, g.label, g.color, g.subnets.map((s) => s.name)])).toEqual([
      [10, 'VLAN 10, Management', '#2FB874', ['Management LAN']],
      [null, 'No VLAN', '#7A8591', ['Lab']],
    ])
  })

  it('measures each subnet with the address map: Occupied and Reserved addresses out of the usable ones', () => {
    const devices = new Map([
      [1, [online(11, '192.168.1.10'), online(12, '192.168.1.150')]],
      [2, [online(21, '10.0.1.2')]],
      [4, [online(41, '10.0.9.5'), online(42, '10.0.9.6'), online(43, '10.0.9.7')]],
    ])
    const [group] = groupSubnetsByVlan(
      [
        subnet({
          id: 1,
          cidr: '192.168.1.0/24',
          vlan: users,
          gateways: ['192.168.1.1'],
          dhcpPools: [{ id: 1, name: 'users', startIp: '192.168.1.100', endIp: '192.168.1.199' }],
        }),
        subnet({ id: 2, cidr: '10.0.1.0/30', vlan: users, gateways: ['10.0.1.1'], includeFirstLast: true }),
        subnet({ id: 3, cidr: '10.0.9.0/31', vlan: users }),
        subnet({ id: 4, cidr: '10.0.9.4/30', vlan: users }),
      ],
      devices,
    )

    const byId = Object.fromEntries(group.subnets.map((s) => [s.id, [s.occupancy.occupied, s.occupancy.reserved, s.occupancy.allocatedPercent]]))
    expect(byId).toEqual({ 1: [2, 100, 41], 2: [1, 1, 50], 3: [0, 0, 0], 4: [2, 0, 100] })
  })

  it('orders the subnets of a VLAN by network address, not by text', () => {
    const [group] = groupSubnetsByVlan(
      [
        subnet({ id: 1, cidr: '192.168.10.0/24', vlan: users }),
        subnet({ id: 2, cidr: '192.168.9.0/24', vlan: users }),
        subnet({ id: 3, cidr: '10.0.0.0/24', vlan: users }),
      ],
      NO_DEVICES,
    )

    expect(group.subnets.map((s) => s.cidr)).toEqual(['10.0.0.0/24', '192.168.9.0/24', '192.168.10.0/24'])
  })
})
