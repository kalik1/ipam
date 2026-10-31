import { applySnapshot, connectAgent, countHeartbeat, disconnectAgent, type AgentSnapshot, type LinkStatus, type LiveAgent } from './liveAgents'
import { applyResult, applySent, dropAgentCommands, type CommandFailure, type PendingCommand } from './liveCommands'
import type { LiveEvent } from './liveEvents'
import { applyCreated, applyOffline, applyScan, type Pulse, type Pulses, type ScanReportData } from './livePulses'

export { brandLedClass } from './liveAgents'
export type { AgentSnapshot, LinkStatus, LiveAgent } from './liveAgents'
export { RECENT_FAILURES_LIMIT, isScanning } from './liveCommands'
export type { CommandFailure, PendingCommand } from './liveCommands'
export { RECENT_SCANS_LIMIT, blinkClass, devicePulseClass, pulseClass, sweepClass } from './livePulses'
export type { Pulse, Pulses, ScanReportData } from './livePulses'

export interface LiveState {
  link: LinkStatus
  received: number
  settled: number
  agents: LiveAgent[]
  agentsLoaded: boolean
  sweeps: Pulses
  anySweep: Pulse
  seenPulses: Pulses
  createdPulses: Pulses
  offlinePulses: Pulses
  scans: ScanReportData[]
  pending: Record<string, PendingCommand>
  failures: CommandFailure[]
}

export type LiveAction =
  | { kind: 'link'; status: 'open' | 'down' }
  | { kind: 'event'; event: LiveEvent }
  | { kind: 'agents'; agents: AgentSnapshot[] }
  | { kind: 'settle'; seq: number }

export const PULSE_MS = 3000

export const INITIAL_LIVE_STATE: LiveState = {
  link: 'connecting',
  received: 0,
  settled: 0,
  agents: [],
  agentsLoaded: false,
  sweeps: {},
  anySweep: { count: 0, seq: 0 },
  seenPulses: {},
  createdPulses: {},
  offlinePulses: {},
  scans: [],
  pending: {},
  failures: [],
}

function applyEvent(state: LiveState, event: LiveEvent): LiveState {
  switch (event.type) {
    case 'agent.connected':
      return connectAgent(state, event.data.agent, event.data.platform)
    case 'agent.heartbeat':
      return countHeartbeat(state, event.data.agent)
    case 'agent.disconnected':
      return dropAgentCommands(disconnectAgent(state, event.data.agent), event.data.agent)
    case 'scan.report':
      return applyScan(state, event.data)
    case 'device.created':
      return applyCreated(state, event.data.deviceId)
    case 'device.offline':
      return applyOffline(state, event.data.deviceIds)
    case 'command.sent':
      return applySent(state, event.data)
    case 'command.result':
      return applyResult(state, event.data)
  }
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
