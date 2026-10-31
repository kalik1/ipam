import { cx } from './cx'
import { blinkClass } from './livePulses'
import type { LiveState } from './liveState'

export type LinkStatus = 'connecting' | 'open' | 'down'

export interface LiveAgent {
  name: string
  platform: string
  connected: boolean
  heartbeats: number
}

export interface AgentSnapshot {
  name: string
  platform: string
}

type AgentUpdate = (agent: LiveAgent) => LiveAgent

function byName(a: LiveAgent, b: LiveAgent): number {
  return a.name.localeCompare(b.name)
}

function upsertAgent(agents: LiveAgent[], name: string, update: AgentUpdate): LiveAgent[] {
  const existing = agents.find((agent) => agent.name === name)
  if (existing) return agents.map((agent) => (agent === existing ? update(agent) : agent))
  return [...agents, update({ name, platform: '', connected: true, heartbeats: 0 })].sort(byName)
}

export function connectAgent(state: LiveState, name: string, platform: string): LiveState {
  return { ...state, agents: upsertAgent(state.agents, name, (agent) => ({ ...agent, platform, connected: true })) }
}

export function countHeartbeat(state: LiveState, name: string): LiveState {
  return {
    ...state,
    agents: upsertAgent(state.agents, name, (agent) => ({ ...agent, connected: true, heartbeats: agent.heartbeats + 1 })),
  }
}

export function disconnectAgent(state: LiveState, name: string): LiveState {
  return { ...state, agents: state.agents.map((agent) => (agent.name === name ? { ...agent, connected: false } : agent)) }
}

export function applySnapshot(state: LiveState, snapshot: AgentSnapshot[]): LiveState {
  const connected = new Map(snapshot.map((agent) => [agent.name, agent.platform]))
  const known = state.agents.map((agent) => {
    const platform = connected.get(agent.name)
    return platform === undefined ? { ...agent, connected: false } : { ...agent, platform, connected: true }
  })
  const added = snapshot
    .filter((agent) => !state.agents.some((known) => known.name === agent.name))
    .map((agent) => ({ name: agent.name, platform: agent.platform, connected: true, heartbeats: 0 }))
  return { ...state, agents: [...known, ...added].sort(byName), agentsLoaded: true }
}

const LINK_LED: Record<LinkStatus, string | undefined> = { connecting: undefined, open: 'on', down: 'err' }

export function brandLedClass(state: Pick<LiveState, 'link' | 'received'>): string {
  return cx('brand-led', LINK_LED[state.link], blinkClass(state.received, 'ev'))
}
