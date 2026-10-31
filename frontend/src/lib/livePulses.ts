import { cx } from './cx'
import { isScanning } from './liveCommands'
import type { LiveEventData } from './liveEvents'
import type { LiveState } from './liveState'

export interface Pulse {
  count: number
  seq: number
}

export type Pulses = Record<number, Pulse>

export type ScanReportData = LiveEventData['scan.report']

export const RECENT_SCANS_LIMIT = 50

function pulse(pulses: Pulses, keys: number[], seq: number): Pulses {
  const next = { ...pulses }
  for (const key of new Set(keys)) next[key] = { count: (pulses[key]?.count ?? 0) + 1, seq }
  return next
}

export function applyScan(state: LiveState, scan: ScanReportData): LiveState {
  const subnetIds = scan.subnets.flatMap((group) => (group.subnetId === null ? [] : [group.subnetId]))
  const deviceIds = scan.subnets.flatMap((group) => group.deviceIds)
  return {
    ...state,
    sweeps: pulse(state.sweeps, subnetIds, state.received),
    anySweep: subnetIds.length > 0 ? { count: state.anySweep.count + 1, seq: state.received } : state.anySweep,
    seenPulses: pulse(state.seenPulses, deviceIds, state.received),
    scans: [scan, ...state.scans].slice(0, RECENT_SCANS_LIMIT),
  }
}

export function applyCreated(state: LiveState, deviceId: number): LiveState {
  return { ...state, createdPulses: pulse(state.createdPulses, [deviceId], state.received) }
}

export function applyOffline(state: LiveState, deviceIds: number[]): LiveState {
  return { ...state, offlinePulses: pulse(state.offlinePulses, deviceIds, state.received) }
}

export function blinkClass(count: number, name: string): string | undefined {
  if (count === 0) return undefined
  return `${name}-${count % 2 === 1 ? 'a' : 'b'}`
}

export function pulseClass(pulse: Pulse | undefined, settled: number, name: string): string | undefined {
  if (!pulse || pulse.seq <= settled) return undefined
  return blinkClass(pulse.count, name)
}

export function sweepClass(state: LiveState, subnetId: number): string | undefined {
  const pass = pulseClass(state.sweeps[subnetId], state.settled, 'pass')
  if (pass) return pass
  return isScanning(state) ? 'loop' : undefined
}

export function devicePulseClass(state: LiveState, deviceId: number): string | undefined {
  const { seenPulses, createdPulses, offlinePulses, settled } = state
  const value = cx(
    pulseClass(seenPulses[deviceId], settled, 'seen'),
    pulseClass(createdPulses[deviceId], settled, 'new'),
    pulseClass(offlinePulses[deviceId], settled, 'fade'),
  )
  return value || undefined
}
