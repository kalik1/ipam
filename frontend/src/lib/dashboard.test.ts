import { describe, expect, it } from 'vitest'
import { latestScans, wentOffline } from './dashboard'
import type { ScanReportData } from './liveState'
import type { Device, ScanReport, Subnet } from '@/types'

function subnetOf(id: number, name: string): Subnet {
  return {
    id,
    cidr: '10.0.0.0/24',
    name,
    gateways: [],
    includeFirstLast: false,
    dhcpPools: [],
    vlanId: 7,
    vlan: null,
    description: '',
    domainName: '',
    dnsServers: '',
    ntpServers: '',
    deviceCount: 0,
    totalHosts: 0,
    usedHosts: 0,
    createdAt: '2026-10-01T00:00:00Z',
    updatedAt: '2026-10-01T00:00:00Z',
  }
}

function device(id: number, ip: string, lastSeen: string, subnet: Subnet | null, status: Device['status'] = 'offline'): Device {
  return {
    id,
    ip,
    mac: '',
    hostname: id === 4 ? '  ' : `host-${id}`,
    vendor: '',
    subnetId: subnet?.id ?? null,
    subnet,
    status,
    lastSeen,
    notes: '',
    createdAt: '2026-10-01T00:00:00Z',
    updatedAt: '2026-10-01T00:00:00Z',
  }
}

describe('wentOffline', () => {
  const lan = subnetOf(3, 'Users LAN')
  const rows = [{ id: 3, name: 'Users LAN', color: '#EE8A2E' }]

  it('lists offline devices most recently seen first, up to a limit, with the cable of their subnet', () => {
    const devices = [
      device(1, '192.168.1.10', '2026-10-31T09:00:00Z', lan),
      device(2, '192.168.1.20', '2026-10-31T10:00:00Z', lan),
      device(3, '192.168.1.30', '2026-10-31T11:00:00Z', lan, 'online'),
      device(4, '192.168.1.40', '2026-10-31T08:00:00Z', lan),
    ]

    expect(wentOffline(devices, rows, 2)).toEqual([
      { id: 2, name: 'host-2', ip: '192.168.1.20', lastSeen: '2026-10-31T10:00:00Z', href: '/subnets/3?ip=192.168.1.20', subnet: 'Users LAN', color: '#EE8A2E' },
      { id: 1, name: 'host-1', ip: '192.168.1.10', lastSeen: '2026-10-31T09:00:00Z', href: '/subnets/3?ip=192.168.1.10', subnet: 'Users LAN', color: '#EE8A2E' },
    ])
  })

  it('sends a device without a subnet to the device list, without a cable', () => {
    const [entry] = wentOffline([device(4, '10.99.0.4', '2026-10-31T08:00:00Z', null)], rows, 5)

    expect(entry).toMatchObject({ name: 'Unnamed device', href: '/devices', subnet: null, color: null })
  })
})

describe('latestScans', () => {
  const reports: ScanReport[] = [
    { id: 5, agent: 'probe', platform: 'linux', deviceCount: 6, receivedAt: '2026-10-31T10:00:00.000Z' },
    { id: 4, agent: 'branch', platform: 'windows', deviceCount: 2, receivedAt: '2026-10-31T09:00:00.000Z' },
  ]

  function scan(receivedAt: string, source: ScanReportData['source'], reportId?: number): ScanReportData {
    return {
      agent: 'probe',
      source,
      receivedAt,
      ...(reportId === undefined ? {} : { reportId }),
      subnets: [
        { subnetId: 1, deviceIds: [7, 8] },
        { subnetId: null, deviceIds: [9] },
      ],
    }
  }

  it('puts live scans not reported yet on top of the stored reports, newest first, up to a limit', () => {
    const live = [scan('2026-10-31T10:05:00.000Z', 'report', 6), scan('2026-10-31T10:02:00.000Z', 'connector'), scan('2026-10-31T10:00:00.000Z', 'report', 5)]

    expect(latestScans(reports, live, new Map([['probe', 'linux']]), 3)).toEqual([
      { key: 'report-6', receivedAt: '2026-10-31T10:05:00.000Z', agent: 'probe', platform: 'linux', devices: 3, source: 'report' },
      { key: 'connector-probe-2026-10-31T10:02:00.000Z', receivedAt: '2026-10-31T10:02:00.000Z', agent: 'probe', platform: 'linux', devices: 3, source: 'connector' },
      { key: 'report-5', receivedAt: '2026-10-31T10:00:00.000Z', agent: 'probe', platform: 'linux', devices: 6, source: 'report' },
    ])
  })

  it('leaves the platform of a live scan empty when its agent is unknown', () => {
    const [entry] = latestScans([], [scan('2026-10-31T10:02:00.000Z', 'connector')], new Map(), 5)

    expect(entry.platform).toBe('')
  })
})
