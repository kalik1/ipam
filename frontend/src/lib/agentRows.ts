import type { Agent } from '../types'
import type { LiveAgent } from './liveState'

export interface AgentRow {
  name: string
  platform: string
  connected: boolean
  heartbeats: number
  connectors: string[]
  connectedAt: string | null
  lastHeartbeatAt: string | null
}

function fromRest(agent: Agent, live: LiveAgent | undefined): AgentRow {
  return {
    name: agent.name,
    platform: agent.platform,
    connected: live?.connected ?? true,
    heartbeats: live?.heartbeats ?? 0,
    connectors: agent.connectors,
    connectedAt: agent.connectedAt,
    lastHeartbeatAt: agent.lastPingAt,
  }
}

function fromLive(agent: LiveAgent): AgentRow {
  return {
    name: agent.name,
    platform: agent.platform,
    connected: agent.connected,
    heartbeats: agent.heartbeats,
    connectors: [],
    connectedAt: null,
    lastHeartbeatAt: null,
  }
}

export function agentRows(rest: Agent[], live: LiveAgent[], baselines: ReadonlyMap<string, number> = new Map()): AgentRow[] {
  const liveByName = new Map(live.map((agent) => [agent.name, agent]))
  const restNames = new Set(rest.map((agent) => agent.name))
  const rows = [
    ...rest.map((agent) => fromRest(agent, liveByName.get(agent.name))),
    ...live.filter((agent) => !restNames.has(agent.name)).map(fromLive),
  ]
  return rows
    .map((row) => ({ ...row, heartbeats: Math.max(0, row.heartbeats - (baselines.get(row.name) ?? 0)) }))
    .sort((a, b) => a.name.localeCompare(b.name))
}

export function withHeartbeat(agents: Agent[], name: string, at: string): Agent[] {
  if (!agents.some((agent) => agent.name === name)) return agents
  return agents.map((agent) => (agent.name === name ? { ...agent, lastPingAt: at } : agent))
}
