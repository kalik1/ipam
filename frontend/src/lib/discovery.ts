import type { LedState } from '../components/StatusLed'
import type { AgentAssignment } from '../types'
import { assignmentStatus } from './assignments'
import { timeAgo } from './format'
import type { CommandFailure, PendingCommand } from './liveState'

export interface CommandOutcome {
  ok: boolean
  at: string
}

export interface RunOverlay {
  pending: PendingCommand[]
  failures: CommandFailure[]
  outcomes: ReadonlyMap<string, CommandOutcome>
}

export interface ConnectorRunView {
  led: LedState
  text: string
  error: boolean
}

const WAITING: ConnectorRunView = { led: 'pending', text: 'Command sent, waiting for the result', error: false }

function sameRun(assignment: AgentAssignment, command: PendingCommand): boolean {
  return command.agent === assignment.agentName && command.connector === assignment.connector.name
}

function when(at: string | null): string {
  return at ? ` ${timeAgo(at)}` : ''
}

function storedRun(assignment: AgentAssignment): ConnectorRunView {
  const { led } = assignmentStatus(assignment.lastStatus)
  const ago = when(assignment.lastRunAt)
  switch (assignment.lastStatus) {
    case 'ok':
      return { led, text: `Last run succeeded${ago}`, error: false }
    case 'error':
      return { led, text: `Last run failed${ago}: ${assignment.lastError ?? 'unknown error'}`, error: true }
    case 'skipped':
      return { led, text: `Skipped${ago}: ${assignment.lastError ?? 'agent not connected'}`, error: false }
    case 'sent':
      return WAITING
    case null:
      return { led, text: 'Never run', error: false }
  }
}

export function connectorRun(assignment: AgentAssignment, overlay: RunOverlay): ConnectorRunView {
  if (overlay.pending.some((command) => sameRun(assignment, command))) return WAITING
  const failure = overlay.failures.find((candidate) => sameRun(assignment, candidate))
  if (failure) return { led: 'error', text: `Last run failed: ${failure.error}`, error: true }
  const outcome = assignment.commandRef ? overlay.outcomes.get(assignment.commandRef) : undefined
  if (outcome?.ok) return { led: 'on', text: `Last run succeeded${when(outcome.at)}`, error: false }
  return storedRun(assignment)
}

const NUMBER = /^\d+$/

function pad(value: string): string {
  return value.padStart(2, '0')
}

function every(step: string, unit: string, single: string): string {
  return step === '1' ? single : `every ${step} ${unit}`
}

export function describeSchedule(cron: string): string {
  const fields = cron.trim().split(/\s+/)
  if (fields.length !== 5) return cron
  const [minute, hour, ...rest] = fields
  if (rest.some((field) => field !== '*')) return cron
  if (hour === '*') {
    if (minute === '*') return 'every minute'
    const step = /^\*\/(\d+)$/.exec(minute)
    if (step) return every(step[1], 'min', 'every minute')
    if (minute === '0') return 'hourly'
    return cron
  }
  const hourStep = /^\*\/(\d+)$/.exec(hour)
  if (hourStep && minute === '0') return every(hourStep[1], 'h', 'hourly')
  if (NUMBER.test(hour) && NUMBER.test(minute)) return `daily at ${pad(hour)}:${pad(minute)}`
  return cron
}
