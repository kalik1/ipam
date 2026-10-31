import type { AgentResult } from '../types'

export const RESULT_POLL_INTERVAL_MS = 2500
export const RESULT_TIMEOUT_MS = 30_000

export interface AwaitCommandResultOptions {
  fetchResult: () => Promise<AgentResult>
  commandId: string
  intervalMs?: number
  timeoutMs?: number
  signal?: AbortSignal
}

function pause(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal?.aborted) return resolve()
    const timer = setTimeout(done, ms)
    function done() {
      clearTimeout(timer)
      signal?.removeEventListener('abort', done)
      resolve()
    }
    signal?.addEventListener('abort', done)
  })
}

async function latestMatching(fetchResult: () => Promise<AgentResult>, commandId: string): Promise<AgentResult | null> {
  try {
    const latest = await fetchResult()
    return latest.id === commandId ? latest : null
  } catch {
    return null
  }
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

export async function awaitCommandResult({
  fetchResult,
  commandId,
  intervalMs = RESULT_POLL_INTERVAL_MS,
  timeoutMs = RESULT_TIMEOUT_MS,
  signal,
}: AwaitCommandResultOptions): Promise<AgentResult | null> {
  const deadline = Date.now() + timeoutMs
  for (;;) {
    await pause(intervalMs, signal)
    if (signal?.aborted) return null
    const found = await latestMatching(fetchResult, commandId)
    if (signal?.aborted) return null
    if (found) return found
    if (Date.now() >= deadline) return null
  }
}
