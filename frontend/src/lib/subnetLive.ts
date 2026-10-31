import { splitIp } from './addressMath'
import { plural } from './format'
import type { LiveEvent } from './liveEvents'
import type { ScanReportData } from './liveState'
import { deviceName } from './portGlyph'
import type { Device } from '../types'

export type ActivityKind = 'scan' | 'new' | 'offline'

export interface ActivityEntry {
  key: string
  kind: ActivityKind
  at: string
  who: string
  what: string
  ip: string | null
}

export type ActivityDevice = Pick<Device, 'id' | 'ip' | 'hostname' | 'status' | 'lastSeen' | 'createdAt'>

export interface ActivityInput {
  subnetId: number
  prefix: number
  devices: readonly ActivityDevice[]
  scans: readonly ScanReportData[]
  now: Date
  limit?: number
}

const ACTIVITY_LIMIT = 100

export function affectsSubnet(event: LiveEvent, subnetId: number, deviceIds: readonly number[]): boolean {
  switch (event.type) {
    case 'scan.report':
      return event.data.subnets.some((group) => group.subnetId === subnetId)
    case 'device.created':
      return event.data.subnetId === subnetId
    case 'device.offline':
      return event.data.deviceIds.some((id) => deviceIds.includes(id))
    default:
      return false
  }
}

function startOfDay(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()
}

function hostLabel(ip: string, prefix: number): string {
  const { network, host } = splitIp(ip, prefix)
  return network ? `.${host}` : ip
}

function scanEntries(scans: readonly ScanReportData[], subnetId: number): ActivityEntry[] {
  return scans.flatMap((scan) => {
    const group = scan.subnets.find((candidate) => candidate.subnetId === subnetId)
    if (!group) return []
    const suffix = scan.source === 'connector' ? ' from a connector' : ''
    return [
      {
        key: `scan-${scan.agent}-${scan.reportId ?? scan.receivedAt}`,
        kind: 'scan' as const,
        at: scan.receivedAt,
        who: scan.agent,
        what: `reported ${plural(group.deviceIds.length, 'device')} here${suffix}`,
        ip: null,
      },
    ]
  })
}

function deviceEntries(devices: readonly ActivityDevice[], prefix: number): ActivityEntry[] {
  return devices.flatMap((device) => {
    const who = deviceName(device)
    const host = hostLabel(device.ip, prefix)
    const added: ActivityEntry = { key: `new-${device.id}`, kind: 'new', at: device.createdAt, who, what: `appeared on ${host}`, ip: device.ip }
    if (device.status !== 'offline') return [added]
    const dropped: ActivityEntry = { key: `off-${device.id}`, kind: 'offline', at: device.lastSeen, who, what: `last seen on ${host}`, ip: device.ip }
    return [added, dropped]
  })
}

export function subnetActivity({ subnetId, prefix, devices, scans, now, limit = ACTIVITY_LIMIT }: ActivityInput): ActivityEntry[] {
  const since = startOfDay(now)
  return [...scanEntries(scans, subnetId), ...deviceEntries(devices, prefix)]
    .map((entry) => ({ entry, time: Date.parse(entry.at) }))
    .filter(({ time }) => time >= since)
    .sort((a, b) => b.time - a.time || a.entry.key.localeCompare(b.entry.key))
    .slice(0, limit)
    .map(({ entry }) => entry)
}
