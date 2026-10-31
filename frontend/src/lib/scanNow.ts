import type { AgentAssignment } from '../types'
import type { CommandFailure, PendingCommand } from './liveState'

export interface ScanNowInput {
  agentsLoaded: boolean
  connected: string[]
  assignments: AgentAssignment[] | null
  pending: PendingCommand[]
  starting: boolean
}

export interface ScanNowStatus {
  led: 'pending' | 'off'
  text: string
}

export interface ScanNowView {
  label: 'Scan now' | 'Scanning'
  lamp: boolean
  busy: boolean
  blocked: boolean
  status: ScanNowStatus | null
}

const IDLE: ScanNowView = { label: 'Scan now', lamp: false, busy: false, blocked: false, status: null }

function waitingText(pending: PendingCommand[]): string {
  if (pending.length === 1) return `Waiting for ${pending[0].connector} on ${pending[0].agent}`
  return `Waiting for ${pending.length} results`
}

export function scanNowView({ agentsLoaded, connected, assignments, pending, starting }: ScanNowInput): ScanNowView {
  if (pending.length > 0) {
    return { label: 'Scanning', lamp: true, busy: true, blocked: true, status: { led: 'pending', text: waitingText(pending) } }
  }
  if (starting) return { ...IDLE, busy: true, blocked: true, status: { led: 'pending', text: 'Sending commands' } }
  if (!agentsLoaded) return IDLE
  if (connected.length === 0) {
    return { ...IDLE, blocked: true, status: { led: 'off', text: 'No agent connected' } }
  }
  if (assignments && scanTargets(connected, assignments).length === 0) {
    return { ...IDLE, status: { led: 'off', text: 'No enabled connector assignments' } }
  }
  return IDLE
}

export interface ScanTarget {
  agent: string
  connectorId: number
  label: string
}

export interface ScanProblem {
  key: string
  text: string
}

export function scanFailures(failures: CommandFailure[], dismissedSeq: number): ScanProblem[] {
  return failures
    .filter((failure) => failure.seq > dismissedSeq)
    .map((failure) => ({ key: failure.commandId, text: `${failure.connector} on ${failure.agent}: ${failure.error}` }))
}

export function scanTargets(connected: string[], assignments: AgentAssignment[]): ScanTarget[] {
  return assignments
    .filter((assignment) => assignment.enabled && connected.includes(assignment.agentName))
    .map((assignment) => ({
      agent: assignment.agentName,
      connectorId: assignment.connectorId,
      label: assignment.connector.label || assignment.connector.name,
    }))
}
