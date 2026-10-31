import type { LedState } from '../components/StatusLed'
import type { AssignmentStatus } from '../types'

export interface AssignmentStatusView {
  led: LedState
  label: string
}

const STATUS_VIEW: Record<AssignmentStatus, AssignmentStatusView> = {
  ok: { led: 'on', label: 'Succeeded' },
  error: { led: 'error', label: 'Failed' },
  sent: { led: 'pending', label: 'Waiting for result' },
  skipped: { led: 'off', label: 'Skipped' },
}

export function assignmentStatus(status: AssignmentStatus | null): AssignmentStatusView {
  return status ? STATUS_VIEW[status] : { led: 'off', label: 'Never run' }
}
