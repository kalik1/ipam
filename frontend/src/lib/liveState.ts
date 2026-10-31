import { cx } from './cx'
import type { LiveEvent } from './liveEvents'

export type LinkStatus = 'connecting' | 'open' | 'down'

export interface LiveAgent {
  name: string
  platform: string
  connected: boolean
  heartbeats: number
}

export interface LiveState {
  link: LinkStatus
  received: number
  agents: LiveAgent[]
  agentsLoaded: boolean
}

export interface AgentSnapshot {
  name: string
  platform: string
}

export type LiveAction =
  | { kind: 'link'; status: 'open' | 'down' }
  | { kind: 'event'; event: LiveEvent }
  | { kind: 'agents'; agents: AgentSnapshot[] }

export const INITIAL_LIVE_STATE: LiveState = { link: 'connecting', received: 0, agents: [], agentsLoaded: false }

type AgentUpdate = (agent: LiveAgent) => LiveAgent

function byName(a: LiveAgent, b: LiveAgent): number {
  return a.name.localeCompare(b.name)
}

function upsertAgent(agents: LiveAgent[], name: string, update: AgentUpdate): LiveAgent[] {
  const existing = agents.find((agent) => agent.name === name)
  if (existing) return agents.map((agent) => (agent === existing ? update(agent) : agent))
  return [...agents, update({ name, platform: '', connected: true, heartbeats: 0 })].sort(byName)
}

function updateAgent(agents: LiveAgent[], name: string, update: AgentUpdate): LiveAgent[] {
  return agents.map((agent) => (agent.name === name ? update(agent) : agent))
}

function applyEvent(state: LiveState, event: LiveEvent): LiveState {
  switch (event.type) {
    case 'agent.connected': {
      const { agent, platform } = event.data
      return { ...state, agents: upsertAgent(state.agents, agent, (a) => ({ ...a, platform, connected: true })) }
    }
    case 'agent.heartbeat':
      return {
        ...state,
        agents: upsertAgent(state.agents, event.data.agent, (a) => ({ ...a, connected: true, heartbeats: a.heartbeats + 1 })),
      }
    case 'agent.disconnected':
      return { ...state, agents: updateAgent(state.agents, event.data.agent, (a) => ({ ...a, connected: false })) }
    case 'scan.report':
    case 'device.created':
    case 'device.offline':
    case 'command.sent':
    case 'command.result':
      return state
  }
}

function applySnapshot(state: LiveState, snapshot: AgentSnapshot[]): LiveState {
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

export function liveReducer(state: LiveState, action: LiveAction): LiveState {
  switch (action.kind) {
    case 'link':
      return { ...state, link: action.status }
    case 'agents':
      return applySnapshot(state, action.agents)
    case 'event':
      return applyEvent({ ...state, received: state.received + 1 }, action.event)
  }
}

export function blinkClass(count: number, name: 'ev' | 'hb'): string | undefined {
  if (count === 0) return undefined
  return `${name}-${count % 2 === 1 ? 'a' : 'b'}`
}

const LINK_LED: Record<LinkStatus, string | undefined> = { connecting: undefined, open: 'on', down: 'err' }

export function brandLedClass(state: Pick<LiveState, 'link' | 'received'>): string {
  return cx('brand-led', LINK_LED[state.link], blinkClass(state.received, 'ev'))
}
