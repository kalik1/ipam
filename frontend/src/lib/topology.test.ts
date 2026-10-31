import { describe, expect, it } from 'vitest'
import { buildTopologyTree, type TopologySubnetRow } from './topology'
import type { Topology, TopologyDevice, TopologySubnet } from '@/types'

function device(id: number, ip: string, status: TopologyDevice['status'] = 'online'): TopologyDevice {
  return { id, ip, hostname: `host-${id}`, status, lastSeen: '2026-10-31T10:00:00Z' }
}

function topologySubnet(id: number, cidr: string, devices: TopologyDevice[], gateways: string[] = []): TopologySubnet {
  return { id, cidr, name: `Subnet ${id}`, gateways, used: devices.length, total: 0, percent: 0, devices }
}

describe('buildTopologyTree', () => {
  it('puts subnets without a VLAN under a gray No VLAN branch with every device', () => {
    const topology: Topology = {
      vlans: [{ id: null, vlanId: null, name: 'Unassigned', description: '', subnets: [topologySubnet(5, '10.9.0.0/24', [device(1, '10.9.0.7')])] }],
    }

    const [branch] = buildTopologyTree(topology, [])

    expect(branch.label).toBe('No VLAN')
    expect(branch.color).toBe('#7A8591')
    expect(branch.subnets.map((subnet) => subnet.id)).toEqual([5])
    expect(branch.subnets[0].ports.map((port) => port.device.ip)).toEqual(['10.9.0.7'])
  })

  it('counts each subnet and draws its devices from the address map of the matching subnet row', () => {
    const servers = { id: 2, name: 'servers', startIp: '192.168.1.10', endIp: '192.168.1.20' }
    const users = { id: 1, name: 'users', startIp: '192.168.1.100', endIp: '192.168.1.200' }
    const row: TopologySubnetRow = { id: 3, cidr: '192.168.1.0/24', gateways: ['192.168.1.1', '192.168.1.2'], dhcpPools: [users, servers], includeFirstLast: false }
    const topology: Topology = {
      vlans: [
        {
          id: 2,
          vlanId: 20,
          name: 'Users',
          description: 'Office clients',
          subnets: [topologySubnet(3, '192.168.1.0/24', [device(10, '192.168.1.10'), device(11, '192.168.1.20', 'offline')], ['192.168.1.1', '192.168.1.2'])],
        },
      ],
    }

    const [branch] = buildTopologyTree(topology, [row])
    const [subnet] = branch.subnets

    expect(branch).toMatchObject({ tag: 20, label: 'VLAN 20, Users', description: 'Office clients', color: '#EE8A2E' })
    expect(subnet.counters).toEqual({ usable: 254, occupied: 2, occupiedOnline: 1, occupiedOffline: 1, reserved: 112, free: 140 })
    expect(subnet.ports[0].slot).toMatchObject({ state: 'occupied', gateway: false, pools: [servers] })
    expect(subnet.ports[1].slot).toMatchObject({ state: 'occupied', pools: [servers] })
  })

  it('keeps a device whose address left the subnet range as an Occupied port', () => {
    const stray = device(30, '10.1.0.9', 'offline')
    const topology: Topology = {
      vlans: [{ id: 1, vlanId: 10, name: 'Management', description: '', subnets: [topologySubnet(1, '10.0.0.0/24', [stray])] }],
    }

    const [port] = buildTopologyTree(topology, [])[0].subnets[0].ports

    expect(port.device).toBe(stray)
    expect(port.slot).toMatchObject({ ip: '10.1.0.9', state: 'occupied', device: stray, gateway: false, pools: [], notUsable: null })
  })

  it('orders the devices of a subnet by address, not by text', () => {
    const topology: Topology = {
      vlans: [
        {
          id: 1,
          vlanId: 10,
          name: 'Management',
          description: '',
          subnets: [topologySubnet(1, '10.0.0.0/24', [device(1, '10.0.0.100'), device(2, '10.0.0.20'), device(3, '10.0.0.5')])],
        },
      ],
    }

    const ports = buildTopologyTree(topology, [])[0].subnets[0].ports

    expect(ports.map((port) => port.device.ip)).toEqual(['10.0.0.5', '10.0.0.20', '10.0.0.100'])
  })

  it('links each subnet to its page and each device to its address on that page', () => {
    const topology: Topology = {
      vlans: [{ id: 3, vlanId: 30, name: 'Servers', description: '', subnets: [topologySubnet(7, '172.16.0.0/16', [device(40, '172.16.5.100')])] }],
    }

    const [subnet] = buildTopologyTree(topology, [])[0].subnets

    expect(subnet.href).toBe('/subnets/7')
    expect(subnet.ports[0].href).toBe('/subnets/7?ip=172.16.5.100')
  })

  it('falls back to the topology gateways when the subnet row is missing', () => {
    const topology: Topology = {
      vlans: [{ id: 1, vlanId: 10, name: 'Management', description: '', subnets: [topologySubnet(9, '10.0.1.0/30', [device(5, '10.0.1.2')], ['10.0.1.1'])] }],
    }

    const [subnet] = buildTopologyTree(topology, [])[0].subnets

    expect(subnet.counters).toEqual({ usable: 2, occupied: 1, occupiedOnline: 1, occupiedOffline: 0, reserved: 1, free: 0 })
  })
})
