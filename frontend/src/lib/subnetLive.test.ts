import { describe, expect, it } from 'vitest'
import type { LiveEvent } from './liveEvents'
import type { ScanReportData } from './liveState'
import { affectsSubnet, subnetActivity, type ActivityDevice } from './subnetLive'

function scan(subnets: ScanReportData['subnets'], receivedAt: Date, overrides: Partial<ScanReportData> = {}): ScanReportData {
  return { agent: 'hq-scanner', source: 'report', receivedAt: receivedAt.toISOString(), reportId: 1, subnets, ...overrides }
}

function device(overrides: Partial<ActivityDevice>): ActivityDevice {
  return {
    id: 1,
    ip: '192.168.1.10',
    hostname: 'nas-01',
    status: 'online',
    lastSeen: new Date(2026, 9, 31, 8, 0, 0).toISOString(),
    createdAt: new Date(2026, 0, 5, 9, 0, 0).toISOString(),
    ...overrides,
  }
}

const NOW = new Date(2026, 9, 31, 12, 30, 0)
const YESTERDAY = new Date(2026, 9, 30, 23, 59, 0)

describe('affectsSubnet', () => {
  const ownDevices = [3, 4]
  const cases: Array<[string, LiveEvent, boolean]> = [
    ['a scan report with devices here', { type: 'scan.report', data: scan([{ subnetId: 1, deviceIds: [3] }], NOW) }, true],
    ['a scan report of other subnets', { type: 'scan.report', data: scan([{ subnetId: 2, deviceIds: [8] }, { subnetId: null, deviceIds: [9] }], NOW) }, false],
    ['a device created here', { type: 'device.created', data: { deviceId: 9, ip: '192.168.1.99', subnetId: 1 } }, true],
    ['a device created elsewhere', { type: 'device.created', data: { deviceId: 9, ip: '10.0.0.9', subnetId: null } }, false],
    ['a device of this subnet going offline', { type: 'device.offline', data: { deviceIds: [8, 4] } }, true],
    ['devices of other subnets going offline', { type: 'device.offline', data: { deviceIds: [8, 9] } }, false],
    ['an agent heartbeat', { type: 'agent.heartbeat', data: { agent: 'probe', at: NOW.toISOString() } }, false],
  ]

  it.each(cases)('handles %s', (_label, event, expected) => {
    expect(affectsSubnet(event, 1, ownDevices)).toBe(expected)
  })
})

describe('subnetActivity', () => {
  it('lists today scans of this subnet, new devices and offline devices, newest first', () => {
    const entries = subnetActivity({
      subnetId: 1,
      prefix: 24,
      now: NOW,
      scans: [
        scan([{ subnetId: 1, deviceIds: [1, 2, 3] }], new Date(2026, 9, 31, 12, 4, 31)),
        scan([{ subnetId: 2, deviceIds: [8] }], new Date(2026, 9, 31, 12, 3, 0)),
        scan([{ subnetId: 1, deviceIds: [1] }], YESTERDAY),
      ],
      devices: [
        device({ id: 1 }),
        device({ id: 2, ip: '192.168.1.150', hostname: 'pixel-visitor', createdAt: new Date(2026, 9, 31, 12, 3, 12).toISOString() }),
        device({ id: 3, ip: '192.168.1.105', hostname: '', status: 'offline', lastSeen: new Date(2026, 9, 31, 11, 29, 40).toISOString() }),
        device({ id: 4, ip: '192.168.1.12', status: 'offline', lastSeen: YESTERDAY.toISOString() }),
      ],
    })

    expect(entries.map(({ kind, who, what, ip }) => ({ kind, who, what, ip }))).toEqual([
      { kind: 'scan', who: 'hq-scanner', what: 'reported 3 devices here', ip: null },
      { kind: 'new', who: 'pixel-visitor', what: 'appeared on .150', ip: '192.168.1.150' },
      { kind: 'offline', who: 'Unnamed device', what: 'last seen on .105', ip: '192.168.1.105' },
    ])
    expect(entries.map((entry) => entry.at)).toEqual([
      new Date(2026, 9, 31, 12, 4, 31).toISOString(),
      new Date(2026, 9, 31, 12, 3, 12).toISOString(),
      new Date(2026, 9, 31, 11, 29, 40).toISOString(),
    ])
  })

  it('names connector scans and counts one device in the singular', () => {
    const entries = subnetActivity({
      subnetId: 1,
      prefix: 24,
      now: NOW,
      scans: [scan([{ subnetId: 1, deviceIds: [5] }], NOW, { source: 'connector', reportId: undefined, agent: 'edge' })],
      devices: [],
    })

    expect(entries.map((entry) => entry.what)).toEqual(['reported 1 device here from a connector'])
  })

  it('shows the host part of the address for subnets wider than a /24', () => {
    const entries = subnetActivity({
      subnetId: 1,
      prefix: 16,
      now: NOW,
      scans: [],
      devices: [device({ ip: '172.16.5.100', createdAt: NOW.toISOString() })],
    })

    expect(entries[0].what).toBe('appeared on .5.100')
  })

  it('keeps the newest entries up to the limit', () => {
    const devices = Array.from({ length: 5 }, (_, index) =>
      device({ id: index + 1, ip: `192.168.1.${index + 1}`, createdAt: new Date(2026, 9, 31, 10, index).toISOString() }),
    )

    const entries = subnetActivity({ subnetId: 1, prefix: 24, now: NOW, scans: [], devices, limit: 2 })

    expect(entries.map((entry) => entry.ip)).toEqual(['192.168.1.5', '192.168.1.4'])
  })
})
