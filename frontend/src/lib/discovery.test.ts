import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { connectorRun, describeSchedule, type RunOverlay } from './discovery'
import type { AgentAssignment, AssignmentStatus } from '@/types'

function assignment(lastStatus: AssignmentStatus | null, extra: Partial<AgentAssignment> = {}): AgentAssignment {
  return {
    id: 1,
    agentName: 'probe',
    connectorId: 4,
    connector: { id: 4, name: 'demo', label: 'Demo', config: {}, createdAt: '2026-10-01T00:00:00Z', updatedAt: '2026-10-01T00:00:00Z' },
    schedule: '*/5 * * * *',
    enabled: true,
    lastRunAt: '2026-10-31T09:50:00.000Z',
    lastStatus,
    lastError: null,
    nextRunAt: null,
    commandRef: 'c1',
    ...extra,
  }
}

const QUIET: RunOverlay = { pending: [], failures: [], outcomes: new Map() }

describe('connectorRun', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-31T10:00:00.000Z'))
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('describes the stored status of the last run when nothing is live', () => {
    expect(connectorRun(assignment(null), QUIET)).toEqual({ led: 'off', text: 'Never run', error: false })
    expect(connectorRun(assignment('ok'), QUIET)).toEqual({ led: 'on', text: 'Last run succeeded 10m ago', error: false })
    expect(connectorRun(assignment('error', { lastError: 'connection refused' }), QUIET)).toEqual({
      led: 'error',
      text: 'Last run failed 10m ago: connection refused',
      error: true,
    })
    expect(connectorRun(assignment('skipped', { lastError: 'agent not connected' }), QUIET)).toEqual({
      led: 'off',
      text: 'Skipped 10m ago: agent not connected',
      error: false,
    })
    expect(connectorRun(assignment('sent'), QUIET)).toEqual({ led: 'pending', text: 'Command sent, waiting for the result', error: false })
  })

  it('waits while a command for the same connector on the same agent is pending', () => {
    const overlay: RunOverlay = { ...QUIET, pending: [{ agent: 'probe', connector: 'demo' }] }

    expect(connectorRun(assignment('error', { lastError: 'old' }), overlay)).toMatchObject({ led: 'pending', error: false })
    expect(connectorRun(assignment('ok', { agentName: 'other' }), overlay)).toMatchObject({ led: 'on' })
  })

  it('shows a live failure of the connector before the stored status catches up', () => {
    const overlay: RunOverlay = { ...QUIET, failures: [{ commandId: 'c2', agent: 'probe', connector: 'demo', error: 'timed out', seq: 4 }] }

    expect(connectorRun(assignment('sent', { commandRef: 'c2' }), overlay)).toEqual({ led: 'error', text: 'Last run failed: timed out', error: true })
  })

  it('shows a live success of the last command before the stored status catches up', () => {
    const overlay: RunOverlay = { ...QUIET, outcomes: new Map([['c2', { ok: true, at: '2026-10-31T09:59:50.000Z' }]]) }

    expect(connectorRun(assignment('sent', { commandRef: 'c2' }), overlay)).toEqual({ led: 'on', text: 'Last run succeeded just now', error: false })
    expect(connectorRun(assignment('sent', { commandRef: 'c3' }), overlay)).toMatchObject({ led: 'pending' })
  })
})

describe('describeSchedule', () => {
  it('words the common cron schedules and keeps any other expression as it is', () => {
    expect(
      ['* * * * *', '*/1 * * * *', '*/5 * * * *', '0 * * * *', '0 */6 * * *', '30 2 * * *', '0 0 * * 1', 'nonsense'].map(describeSchedule),
    ).toEqual(['every minute', 'every minute', 'every 5 min', 'hourly', 'every 6 h', 'daily at 02:30', '0 0 * * 1', 'nonsense'])
  })
})
