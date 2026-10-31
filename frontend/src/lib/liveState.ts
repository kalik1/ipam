import { cx } from './cx'
import type { LiveEvent, LiveEventData } from './liveEvents'

export type LinkStatus = 'connecting' | 'open' | 'down'

export interface LiveAgent {
  name: string
  platform: string
  connected: boolean
  heartbeats: number
}

export interface Pulse {
  count: number
  seq: number
}

export type Pulses = Record<number, Pulse>

export type ScanReportData = LiveEventData['scan.report']

export interface PendingCommand {
  agent: string
  connector: string
}

export interface LiveState {
  link: LinkStatus
  received: number
  settled: number
  agents: LiveAgent[]
  agentsLoaded: boolean
  sweeps: Pulses
  flashes: Pulses
  plugs: Pulses
  fades: Pulses
  scans: ScanReportData[]
  pending: Record<string, PendingCommand>
  failures: CommandFailure[]
}

export interface CommandFailure extends PendingCommand {
  commandId: string
  error: string
  seq: number
}

export interface AgentSnapshot {
  name: string
  platform: string
}

export type LiveAction =
  | { kind: 'link'; status: 'open' | 'down' }
  | { kind: 'event'; event: LiveEvent }
  | { kind: 'agents'; agents: AgentSnapshot[] }
  | { kind: 'settle'; seq: number }

export const RECENT_SCANS_LIMIT = 50
export const PULSE_MS = 3000
export const RECENT_FAILURES_LIMIT = 10

export const INITIAL_LIVE_STATE: LiveState = {
  link: 'connecting',
  received: 0,
  settled: 0,
  agents: [],
  agentsLoaded: false,
  sweeps: {},
  flashes: {},
  plugs: {},
  fades: {},
  scans: [],
  pending: {},
  failures: [],
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

function updateAgent(agents: LiveAgent[], name: string, update: AgentUpdate): LiveAgent[] {
  return agents.map((agent) => (agent.name === name ? update(agent) : agent))
}

function pulse(pulses: Pulses, keys: number[], seq: number): Pulses {
  const next = { ...pulses }
  for (const key of new Set(keys)) next[key] = { count: (pulses[key]?.count ?? 0) + 1, seq }
  return next
}

function applyScan(state: LiveState, scan: ScanReportData): LiveState {
  const subnetIds = scan.subnets.flatMap((group) => (group.subnetId === null ? [] : [group.subnetId]))
  const deviceIds = scan.subnets.flatMap((group) => group.deviceIds)
  return {
    ...state,
    sweeps: pulse(state.sweeps, subnetIds, state.received),
    flashes: pulse(state.flashes, deviceIds, state.received),
    scans: [scan, ...state.scans].slice(0, RECENT_SCANS_LIMIT),
  }
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
    case 'agent.disconnected': {
      const { agent } = event.data
      return {
        ...state,
        agents: updateAgent(state.agents, agent, (a) => ({ ...a, connected: false })),
        pending: Object.fromEntries(Object.entries(state.pending).filter(([, command]) => command.agent !== agent)),
      }
    }
    case 'scan.report':
      return applyScan(state, event.data)
    case 'device.created':
      return { ...state, plugs: pulse(state.plugs, [event.data.deviceId], state.received) }
    case 'device.offline':
      return { ...state, fades: pulse(state.fades, event.data.deviceIds, state.received) }
    case 'command.sent': {
      const { commandId, agent, connector } = event.data
      return {
        ...state,
        pending: { ...state.pending, [commandId]: { agent, connector } },
        failures: state.failures.filter((failure) => failure.agent !== agent || failure.connector !== connector),
      }
    }
    case 'command.result':
      return applyResult(state, event.data)
  }
}

function applyResult(state: LiveState, result: LiveEventData['command.result']): LiveState {
  const command = state.pending[result.commandId]
  if (!command) return state
  const pending = { ...state.pending }
  delete pending[result.commandId]
  if (result.ok) return { ...state, pending }
  const failure: CommandFailure = {
    commandId: result.commandId,
    ...command,
    error: result.error ?? 'Unknown error',
    seq: state.received,
  }
  return { ...state, pending, failures: [failure, ...state.failures].slice(0, RECENT_FAILURES_LIMIT) }
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
      return action.status === 'down' ? { ...state, link: 'down', pending: {} } : { ...state, link: action.status }
    case 'agents':
      return applySnapshot(state, action.agents)
    case 'settle':
      return action.seq > state.settled ? { ...state, settled: action.seq } : state
    case 'event':
      return applyEvent({ ...state, received: state.received + 1 }, action.event)
  }
}

export function blinkClass(count: number, name: string): string | undefined {
  if (count === 0) return undefined
  return `${name}-${count % 2 === 1 ? 'a' : 'b'}`
}

export function pulseClass(pulse: Pulse | undefined, settled: number, name: string): string | undefined {
  if (!pulse || pulse.seq <= settled) return undefined
  return blinkClass(pulse.count, name)
}

export function isScanning(state: Pick<LiveState, 'pending'>): boolean {
  return Object.keys(state.pending).length > 0
}

export function sweepClass(state: LiveState, subnetId: number): string | undefined {
  if (isScanning(state)) return 'loop'
  return pulseClass(state.sweeps[subnetId], state.settled, 'pass')
}

export function devicePulseClass(state: LiveState, deviceId: number): string | undefined {
  const { flashes, plugs, fades, settled } = state
  const value = cx(
    pulseClass(flashes[deviceId], settled, 'seen'),
    pulseClass(plugs[deviceId], settled, 'new'),
    pulseClass(fades[deviceId], settled, 'fade'),
  )
  return value || undefined
}

const LINK_LED: Record<LinkStatus, string | undefined> = { connecting: undefined, open: 'on', down: 'err' }

export function brandLedClass(state: Pick<LiveState, 'link' | 'received'>): string {
  return cx('brand-led', LINK_LED[state.link], blinkClass(state.received, 'ev'))
}
