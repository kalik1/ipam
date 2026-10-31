import { describe, expect, it } from 'vitest'
import type { AgentAssignment } from '../types'
import { scanFailures, scanNowView, scanTargets, type ScanNowInput } from './scanNow'

function assignment(agentName: string, connectorId: number, enabled = true, label = ''): AgentAssignment {
  return {
    id: connectorId * 100 + agentName.length,
    agentName,
    connectorId,
    connector: { id: connectorId, name: connectorId === 1 ? 'mikrotik' : 'demo', label, config: {}, createdAt: '', updatedAt: '' },
    schedule: '*/5 * * * *',
    enabled,
    lastRunAt: null,
    lastStatus: null,
    lastError: null,
    nextRunAt: null,
    commandRef: null,
  }
}

describe('scanTargets', () => {
  it('runs every enabled assignment of the connected agents', () => {
    const targets = scanTargets(
      ['edge', 'probe'],
      [assignment('probe', 1), assignment('probe', 2, false), assignment('edge', 2, true, 'Lab demo'), assignment('gone', 1)],
    )

    expect(targets).toEqual([
      { agent: 'probe', connectorId: 1, label: 'mikrotik' },
      { agent: 'edge', connectorId: 2, label: 'Lab demo' },
    ])
  })
})

const READY: ScanNowInput = {
  agentsLoaded: true,
  connected: ['probe'],
  assignments: [assignment('probe', 2)],
  pending: [],
  starting: false,
}

describe('scanNowView', () => {
  it('offers a scan with an unlit lamp when an enabled assignment can run', () => {
    expect(scanNowView(READY)).toEqual({ label: 'Scan now', lamp: false, busy: false, blocked: false, status: null })
  })

  it('lights the lamp and says scanning while commands are pending, whoever sent them', () => {
    const one = scanNowView({ ...READY, pending: [{ agent: 'probe', connector: 'demo' }] })
    const two = scanNowView({
      ...READY,
      assignments: [],
      pending: [
        { agent: 'probe', connector: 'demo' },
        { agent: 'edge', connector: 'mikrotik' },
      ],
    })

    expect(one).toEqual({
      label: 'Scanning',
      lamp: true,
      busy: true,
      blocked: true,
      status: { led: 'pending', text: 'Waiting for demo on probe' },
    })
    expect(two.status).toEqual({ led: 'pending', text: 'Waiting for 2 results' })
  })

  it('stays unlit while the commands are being sent', () => {
    expect(scanNowView({ ...READY, starting: true })).toEqual({
      label: 'Scan now',
      lamp: false,
      busy: true,
      blocked: true,
      status: { led: 'pending', text: 'Sending commands' },
    })
  })

  it('explains that no agent is connected and blocks the scan', () => {
    expect(scanNowView({ ...READY, connected: [] })).toEqual({
      label: 'Scan now',
      lamp: false,
      busy: false,
      blocked: true,
      status: { led: 'off', text: 'No agent connected' },
    })
  })

  it('explains that no connected agent has an enabled assignment, and lets a click check again', () => {
    const disabledOnly = scanNowView({ ...READY, assignments: [assignment('probe', 2, false), assignment('gone', 1)] })

    expect(disabledOnly).toEqual({
      label: 'Scan now',
      lamp: false,
      busy: false,
      blocked: false,
      status: { led: 'off', text: 'No enabled connector assignments' },
    })
  })

  it('says nothing about availability before agents and assignments are loaded', () => {
    expect(scanNowView({ ...READY, agentsLoaded: false, connected: [] }).status).toBeNull()
    expect(scanNowView({ ...READY, assignments: null }).status).toBeNull()
  })
})

describe('scanFailures', () => {
  it('lists the errors of failed commands received after the last dismissal, newest first', () => {
    const failures = [
      { commandId: 'c3', agent: 'edge', connector: 'mikrotik', error: 'timeout', seq: 9 },
      { commandId: 'c1', agent: 'probe', connector: 'mikrotik', error: 'connect ECONNREFUSED', seq: 4 },
    ]

    expect(scanFailures(failures, 0)).toEqual([
      { key: 'c3', text: 'mikrotik on edge: timeout' },
      { key: 'c1', text: 'mikrotik on probe: connect ECONNREFUSED' },
    ])
    expect(scanFailures(failures, 4)).toEqual([{ key: 'c3', text: 'mikrotik on edge: timeout' }])
    expect(scanFailures(failures, 9)).toEqual([])
  })
})
