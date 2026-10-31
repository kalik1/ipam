import type { ScanReportData } from './liveState'
import { deviceName } from './portGlyph'
import { LOW_FREE_RATIO, type RackSummary } from './rack'
import { resultPath } from './search'
import type { Device, ScanReport, Summary } from '../types'

export type DeviceTotals = Pick<Summary, 'devices' | 'devicesOnline' | 'devicesOffline'>

export interface SummaryStat {
  label: string
  value: string
  note: string
  warn: boolean
}

function count(value: number): string {
  return value.toLocaleString('en-US')
}

export function summaryStats(rack: RackSummary, devices: DeviceTotals): SummaryStat[] {
  const { counters, freePercent, low } = rack
  return [
    { label: 'Devices', value: count(devices.devices), note: `${count(devices.devicesOnline)} online`, warn: false },
    { label: 'Offline now', value: count(devices.devicesOffline), note: 'last seen over 5 min ago', warn: false },
    { label: 'Usable addresses', value: count(counters.usable), note: '', warn: false },
    { label: 'Free addresses', value: count(counters.free), note: `${freePercent}% of usable`, warn: false },
    { label: 'Subnets low on free', value: count(low), note: `under ${LOW_FREE_RATIO * 100}% free`, warn: low > 0 },
  ]
}

export interface OfflineEntry {
  id: number
  name: string
  ip: string
  lastSeen: string
  href: string
  subnet: string | null
  color: string | null
}

export interface SubnetCable {
  id: number
  name: string
  color: string
}

export function wentOffline(devices: readonly Device[], subnets: readonly SubnetCable[], limit: number): OfflineEntry[] {
  const byId = new Map(subnets.map((subnet) => [subnet.id, subnet]))
  return devices
    .filter((device) => device.status === 'offline')
    .map((device) => ({ device, seen: Date.parse(device.lastSeen) }))
    .sort((a, b) => b.seen - a.seen)
    .slice(0, limit)
    .map(({ device }) => {
      const cable = device.subnetId === null ? undefined : byId.get(device.subnetId)
      return {
        id: device.id,
        name: deviceName(device),
        ip: device.ip,
        lastSeen: device.lastSeen,
        href: resultPath(device),
        subnet: cable?.name ?? device.subnet?.name ?? null,
        color: cable?.color ?? null,
      }
    })
}

export interface ScanEntry {
  key: string
  receivedAt: string
  agent: string
  platform: string
  devices: number
  source: ScanReportData['source']
}

function storedScan(report: ScanReport): ScanEntry {
  const { id, receivedAt, agent, platform, deviceCount } = report
  return { key: `report-${id}`, receivedAt, agent, platform, devices: deviceCount, source: 'report' }
}

function liveScan(scan: ScanReportData, platforms: ReadonlyMap<string, string>): ScanEntry {
  const key = scan.reportId === undefined ? `${scan.source}-${scan.agent}-${scan.receivedAt}` : `report-${scan.reportId}`
  const devices = scan.subnets.reduce((total, group) => total + group.deviceIds.length, 0)
  return { key, receivedAt: scan.receivedAt, agent: scan.agent, platform: platforms.get(scan.agent) ?? '', devices, source: scan.source }
}

export function latestScans(
  reports: readonly ScanReport[],
  live: readonly ScanReportData[],
  platforms: ReadonlyMap<string, string>,
  limit: number,
): ScanEntry[] {
  const stored = new Set(reports.map((report) => report.id))
  const fresh = live.filter((scan) => scan.reportId === undefined || !stored.has(scan.reportId)).map((scan) => liveScan(scan, platforms))
  return [...fresh, ...reports.map(storedScan)]
    .map((entry) => ({ entry, time: Date.parse(entry.receivedAt) }))
    .sort((a, b) => b.time - a.time)
    .slice(0, limit)
    .map(({ entry }) => entry)
}
