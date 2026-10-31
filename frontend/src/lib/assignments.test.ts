import { describe, expect, it } from 'vitest'
import { assignmentStatus } from './assignments'

describe('assignmentStatus', () => {
  it('shows a successful run as a lit LED', () => {
    expect(assignmentStatus('ok')).toEqual({ led: 'on', label: 'Succeeded' })
  })

  it('shows a failed run as a red LED', () => {
    expect(assignmentStatus('error')).toEqual({ led: 'error', label: 'Failed' })
  })

  it('shows a command still waiting for its result as pending', () => {
    expect(assignmentStatus('sent')).toEqual({ led: 'pending', label: 'Waiting for result' })
  })

  it('shows a run skipped because the agent was not connected as a dark LED', () => {
    expect(assignmentStatus('skipped')).toEqual({ led: 'off', label: 'Skipped' })
  })

  it('shows an assignment that never ran as a dark LED', () => {
    expect(assignmentStatus(null)).toEqual({ led: 'off', label: 'Never run' })
  })
})
