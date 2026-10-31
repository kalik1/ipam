import type { AgentResult } from '../types'
import type { LiveEventData } from './liveEvents'

export const RESULT_TIMEOUT_MS = 30_000

export type CommandResultEvent = LiveEventData['command.result']

export type CommandRun =
  | { status: 'idle' }
  | { status: 'sending' }
  | { status: 'waiting'; commandId: string }
  | { status: 'done'; result: AgentResult }
  | { status: 'timeout' }
  | { status: 'error'; message: string }

function resultFromEvent(event: CommandResultEvent, receivedAt: string): AgentResult {
  if (event.ok) return { id: event.commandId, ok: true, receivedAt }
  return { id: event.commandId, ok: false, error: event.error ?? 'Unknown error', receivedAt }
}

export function commandOutcome(
  commandId: string,
  event: CommandResultEvent | undefined,
  latest: AgentResult | null,
  now: string,
): CommandRun {
  if (latest?.id === commandId) return { status: 'done', result: latest }
  if (event) return { status: 'done', result: resultFromEvent(event, now) }
  return { status: 'timeout' }
}

export type ResultRow = Record<string, unknown>

export interface ResultSections {
  devices: ResultRow[]
  subnets: ResultRow[]
  vlans: ResultRow[]
  meta: ResultRow | undefined
  empty: boolean
  vlanName: (tag: unknown) => string | null
}

export function isRecord(value: unknown): value is ResultRow {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function rows(value: unknown): ResultRow[] {
  return Array.isArray(value) ? value.filter(isRecord) : []
}

export function resultSections(data: Record<string, unknown> | undefined): ResultSections {
  const devices = rows(data?.devices)
  const subnets = rows(data?.subnets)
  const vlans = rows(data?.vlans)
  const meta = isRecord(data?.meta) ? data.meta : undefined
  const names = new Map<number, string>()
  for (const vlan of vlans) {
    if (typeof vlan.vlanId === 'number') names.set(vlan.vlanId, String(vlan.name ?? ''))
  }
  return {
    devices,
    subnets,
    vlans,
    meta,
    empty: devices.length === 0 && subnets.length === 0 && vlans.length === 0 && meta === undefined,
    vlanName: (tag) => (typeof tag === 'number' ? (names.get(tag) ?? String(tag)) : null),
  }
}

export function formatValue(value: unknown): string | null {
  if (value === undefined || value === null) return null
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}
