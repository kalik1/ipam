import type { LiveEventData } from './liveEvents'
import type { LiveState } from './liveState'

export interface PendingCommand {
  agent: string
  connector: string
}

export interface CommandFailure extends PendingCommand {
  commandId: string
  error: string
  seq: number
}

export const RECENT_FAILURES_LIMIT = 10

export function applySent(state: LiveState, sent: LiveEventData['command.sent']): LiveState {
  const { commandId, agent, connector } = sent
  return {
    ...state,
    pending: { ...state.pending, [commandId]: { agent, connector } },
    failures: state.failures.filter((failure) => failure.agent !== agent || failure.connector !== connector),
  }
}

export function applyResult(state: LiveState, result: LiveEventData['command.result']): LiveState {
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

export function dropAgentCommands(state: LiveState, agent: string): LiveState {
  return { ...state, pending: Object.fromEntries(Object.entries(state.pending).filter(([, command]) => command.agent !== agent)) }
}

export function isScanning(state: Pick<LiveState, 'pending'>): boolean {
  return Object.keys(state.pending).length > 0
}
