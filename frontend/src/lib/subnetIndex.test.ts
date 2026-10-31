import { describe, expect, it } from 'vitest'
import { groupSubnetsByVlan, type IndexableSubnet } from './subnetIndex'

function subnet(overrides: Partial<IndexableSubnet> & Pick<IndexableSubnet, 'id' | 'cidr'>): IndexableSubnet {
  return { name: `Subnet ${overrides.id}`, vlan: null, deviceCount: 0, totalHosts: 254, ...overrides }
}

const management = { vlanId: 10, name: 'Management' }
const users = { vlanId: 20, name: 'Users' }

describe('groupSubnetsByVlan', () => {
  it('lists each subnet under its VLAN with the VLAN cable color, VLANs by ID', () => {
    const groups = groupSubnetsByVlan([
      subnet({ id: 1, cidr: '192.168.1.0/24', name: 'Users LAN', vlan: users }),
      subnet({ id: 2, cidr: '10.0.0.0/24', name: 'Management LAN', vlan: management }),
    ])

    expect(groups.map((g) => [g.label, g.color, g.subnets.map((s) => s.name)])).toEqual([
      ['VLAN 10, Management', '#2FB874', ['Management LAN']],
      ['VLAN 20, Users', '#EE8A2E', ['Users LAN']],
    ])
  })

  it('puts subnets without a VLAN in a gray group after every VLAN', () => {
    const groups = groupSubnetsByVlan([
      subnet({ id: 1, cidr: '172.31.0.0/24', name: 'Lab' }),
      subnet({ id: 2, cidr: '10.0.0.0/24', name: 'Management LAN', vlan: management }),
    ])

    expect(groups.map((g) => [g.tag, g.label, g.color, g.subnets.map((s) => s.name)])).toEqual([
      [10, 'VLAN 10, Management', '#2FB874', ['Management LAN']],
      [null, 'No VLAN', '#7A8591', ['Lab']],
    ])
  })

  it('gives each subnet its share of usable addresses with a device, as a whole percent', () => {
    const [group] = groupSubnetsByVlan([
      subnet({ id: 1, cidr: '192.168.1.0/24', vlan: users, deviceCount: 3, totalHosts: 254 }),
      subnet({ id: 2, cidr: '10.0.1.0/30', vlan: users, deviceCount: 2, totalHosts: 4 }),
      subnet({ id: 3, cidr: '10.0.9.0/31', vlan: users, deviceCount: 0, totalHosts: 0 }),
      subnet({ id: 4, cidr: '10.0.9.4/30', vlan: users, deviceCount: 3, totalHosts: 2 }),
    ])

    const percentById = Object.fromEntries(group.subnets.map((s) => [s.id, s.percent]))
    expect(percentById).toEqual({ 1: 1, 2: 50, 3: 0, 4: 100 })
  })

  it('orders the subnets of a VLAN by network address, not by text', () => {
    const [group] = groupSubnetsByVlan([
      subnet({ id: 1, cidr: '192.168.10.0/24', vlan: users }),
      subnet({ id: 2, cidr: '192.168.9.0/24', vlan: users }),
      subnet({ id: 3, cidr: '10.0.0.0/24', vlan: users }),
    ])

    expect(group.subnets.map((s) => s.cidr)).toEqual(['10.0.0.0/24', '192.168.9.0/24', '192.168.10.0/24'])
  })
})
