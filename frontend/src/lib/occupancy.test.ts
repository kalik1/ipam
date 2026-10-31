import { describe, expect, it } from 'vitest'
import type { AddressMapDevice, AddressMapSubnet } from './addressMap'
import { devicesBySubnet, occupancyText, subnetOccupancy, sumOccupancy } from './occupancy'
import type { Topology, TopologyDevice } from '../types'

function device(id: number, ip: string, status: AddressMapDevice['status'] = 'online'): AddressMapDevice {
  return { id, ip, status }
}

const usersLan: AddressMapSubnet = {
  cidr: '192.168.1.0/24',
  gateways: ['192.168.1.1'],
  dhcpPools: [{ id: 1, name: 'users', startIp: '192.168.1.100', endIp: '192.168.1.199' }],
  includeFirstLast: false,
}

const p2p: AddressMapSubnet = { cidr: '10.0.1.0/30', gateways: ['10.0.1.1'], dhcpPools: [], includeFirstLast: false }

describe('subnetOccupancy', () => {
  it('counts Occupied, Reserved and Free addresses the way the address map does', () => {
    const occupancy = subnetOccupancy(usersLan, [
      device(1, '192.168.1.10'),
      device(2, '192.168.1.150', 'offline'),
      device(3, '192.168.1.1'),
    ])

    expect(occupancy).toEqual({ occupied: 3, reserved: 99, free: 152, usable: 254, freePercent: 59, allocatedPercent: 41 })
  })

  it('ignores devices outside the subnet', () => {
    expect(subnetOccupancy(usersLan, [device(1, '10.0.0.5')]).occupied).toBe(0)
  })

  it('is fully allocated when no address is free', () => {
    expect(subnetOccupancy(p2p, [device(1, '10.0.1.2')])).toEqual({
      occupied: 1,
      reserved: 1,
      free: 0,
      usable: 2,
      freePercent: 0,
      allocatedPercent: 100,
    })
  })

  it('has nothing allocated in a subnet without usable addresses', () => {
    const host: AddressMapSubnet = { cidr: '10.0.9.1/32', gateways: [], dhcpPools: [], includeFirstLast: false }

    expect(subnetOccupancy(host, [device(1, '10.0.9.1')])).toEqual({
      occupied: 0,
      reserved: 0,
      free: 0,
      usable: 0,
      freePercent: 0,
      allocatedPercent: 0,
    })
  })
})

describe('sumOccupancy', () => {
  it('adds the counters across subnets and recomputes the percentages', () => {
    const total = sumOccupancy([
      subnetOccupancy(usersLan, [device(1, '192.168.1.10'), device(2, '192.168.1.150'), device(3, '192.168.1.1')]),
      subnetOccupancy(p2p, [device(4, '10.0.1.2')]),
    ])

    expect(total).toEqual({ occupied: 4, reserved: 100, free: 152, usable: 256, freePercent: 59, allocatedPercent: 41 })
  })

  it('is empty for no subnets', () => {
    expect(sumOccupancy([])).toEqual({ occupied: 0, reserved: 0, free: 0, usable: 0, freePercent: 0, allocatedPercent: 0 })
  })
})

describe('occupancyText', () => {
  it('spells out the address states with the glossary terms', () => {
    expect(occupancyText(subnetOccupancy(p2p, [device(1, '10.0.1.2')]))).toBe('1 occupied, 1 reserved, 0 free of 2 usable addresses')
    expect(occupancyText(sumOccupancy([]))).toBe('No usable addresses')
  })
})

describe('devicesBySubnet', () => {
  function topologyDevice(id: number, ip: string): TopologyDevice {
    return { id, ip, hostname: '', status: 'online', lastSeen: '2026-10-31T10:00:00.000Z' }
  }

  function topologySubnet(id: number, devices: TopologyDevice[]) {
    return { id, cidr: '10.0.0.0/24', name: `Subnet ${id}`, gateways: [], used: devices.length, total: 254, percent: 0, devices }
  }

  it('collects the devices of every subnet across the VLANs', () => {
    const topology: Topology = {
      vlans: [
        { id: 1, vlanId: 10, name: 'Management', description: '', subnets: [topologySubnet(1, [topologyDevice(5, '10.0.0.5')])] },
        { id: null, vlanId: null, name: 'Unassigned', description: '', subnets: [topologySubnet(4, []), topologySubnet(6, [topologyDevice(9, '172.31.0.9')])] },
      ],
    }

    const devices = devicesBySubnet(topology)

    expect([...devices.keys()]).toEqual([1, 4, 6])
    expect(devices.get(6)?.map((entry) => entry.id)).toEqual([9])
  })
})
