import { describe, expect, it } from 'vitest'
import type { Agent } from '../types'
import { agentRows, withHeartbeat } from './agentRows'
import type { LiveAgent } from './liveState'

function restAgent(name: string, overrides: Partial<Agent> = {}): Agent {
  return {
    name,
    platform: 'linux',
    connectors: ['mikrotik'],
    connectedAt: '2026-10-31T09:00:00.000Z',
    lastPingAt: '2026-10-31T09:59:30.000Z',
    ...overrides,
  }
}

function liveAgent(name: string, overrides: Partial<LiveAgent> = {}): LiveAgent {
  return { name, platform: 'linux', connected: true, heartbeats: 0, ...overrides }
}

describe('agentRows', () => {
  it('lists an agent from the REST snapshot as connected while live state does not know it yet', () => {
    expect(agentRows([restAgent('probe')], [])).toEqual([
      {
        name: 'probe',
        platform: 'linux',
        connected: true,
        heartbeats: 0,
        connectors: ['mikrotik'],
        connectedAt: '2026-10-31T09:00:00.000Z',
        lastHeartbeatAt: '2026-10-31T09:59:30.000Z',
      },
    ])
  })

  it('marks an agent disconnected when the live state says so', () => {
    const [row] = agentRows([restAgent('probe')], [liveAgent('probe', { connected: false })])

    expect(row.connected).toBe(false)
  })

  it('counts only the heartbeats received after the baseline', () => {
    const rows = agentRows(
      [restAgent('alpha'), restAgent('beta')],
      [liveAgent('alpha', { heartbeats: 5 }), liveAgent('beta', { heartbeats: 2 })],
      new Map([['alpha', 3]]),
    )

    expect(rows.map((row) => [row.name, row.heartbeats])).toEqual([
      ['alpha', 2],
      ['beta', 2],
    ])
  })

  it('keeps agents known only to the live state, sorted by name, without connection details', () => {
    const rows = agentRows([restAgent('mike')], [liveAgent('alpha', { connected: false, platform: 'windows' })])

    expect(rows.map((row) => row.name)).toEqual(['alpha', 'mike'])
    expect(rows[0]).toEqual({
      name: 'alpha',
      platform: 'windows',
      connected: false,
      heartbeats: 0,
      connectors: [],
      connectedAt: null,
      lastHeartbeatAt: null,
    })
  })
})

describe('withHeartbeat', () => {
  it('moves the last heartbeat of the agent that sent it and leaves the others alone', () => {
    const agents = [restAgent('alpha'), restAgent('beta')]

    const next = withHeartbeat(agents, 'beta', '2026-10-31T10:00:00.000Z')

    expect(next.map((agent) => [agent.name, agent.lastPingAt])).toEqual([
      ['alpha', '2026-10-31T09:59:30.000Z'],
      ['beta', '2026-10-31T10:00:00.000Z'],
    ])
  })

  it('returns the same list when the agent is not listed', () => {
    const agents = [restAgent('alpha')]

    expect(withHeartbeat(agents, 'ghost', '2026-10-31T10:00:00.000Z')).toBe(agents)
  })
})
