import { useState, type FormEvent } from 'react'
import {
  assignConnector,
  deleteAgentAssignment,
  getErrorMessage,
  moveAgentAssignment,
  runAgentAssignment,
  updateAgentAssignment,
} from '@/lib/api'
import { assignmentStatus } from '@/lib/assignments'
import { formatTimestamp, timeAgo } from '@/lib/format'
import { isRunPending, useCommandRun } from '@/lib/useCommandRun'
import type { AgentAssignment, Connector } from '@/types'
import { Button } from '@/components/Button'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { FormField, inputClass } from '@/components/FormField'
import { StatusLed } from '@/components/StatusLed'
import { Table } from '@/components/Table'
import { Tooltip } from '@/components/Tooltip'
import { RunFeedback } from './CommandResultView'

const CRON_HINT = 'For example */5 * * * * (every 5 min), 0 * * * * (hourly), 0 0 * * * (daily)'
const COLUMNS = 7

function connectorLabel(assignment: AgentAssignment): string {
  return assignment.connector.label || assignment.connector.name
}

interface AssignmentsSectionProps {
  agent: string
  connectors: Connector[]
  assignments: AgentAssignment[]
  moveTargets: string[]
  onChanged: () => void
}

export function AssignmentsSection({ agent, connectors, assignments, moveTargets, onChanged }: AssignmentsSectionProps) {
  const [error, setError] = useState('')
  const [editing, setEditing] = useState<number | null>(null)
  const [moving, setMoving] = useState<number | null>(null)
  const [toRemove, setToRemove] = useState<AgentAssignment | null>(null)
  const [removing, setRemoving] = useState(false)

  async function change(action: () => Promise<unknown>, failure: string): Promise<boolean> {
    setError('')
    try {
      await action()
      onChanged()
      return true
    } catch (err) {
      setError(getErrorMessage(err, failure))
      return false
    }
  }

  async function handleRemove() {
    if (!toRemove) return
    setRemoving(true)
    await change(() => deleteAgentAssignment(agent, toRemove.connectorId), 'Failed to remove assignment')
    setRemoving(false)
    setToRemove(null)
  }

  return (
    <section className="disc-section" aria-label={`Connector assignments of ${agent}`}>
      <div className="disc-section-head">
        <h3 className="section-title">Connector assignments</h3>
        <span className="list-count">
          {assignments.length} {assignments.length === 1 ? 'connector' : 'connectors'} scheduled
        </span>
      </div>

      <AssignForm agent={agent} connectors={connectors} onAssign={change} />

      {error && (
        <p className="alert" role="alert">
          {error}
        </p>
      )}

      {assignments.length === 0 ? (
        <p className="disc-note">No connectors assigned to this agent.</p>
      ) : (
        <div className="disc-table">
          <Table>
            <thead>
              <tr>
                <th>Connector</th>
                <th>Schedule</th>
                <th>Enabled</th>
                <th>Last status</th>
                <th>Last run</th>
                <th>Next run</th>
                <th className="num">Actions</th>
              </tr>
            </thead>
            <tbody>
              {assignments.map((assignment) => (
                <AssignmentRow
                  key={assignment.id}
                  agent={agent}
                  assignment={assignment}
                  editing={editing === assignment.id}
                  moving={moving === assignment.id}
                  moveTargets={moveTargets}
                  onEdit={(open) => setEditing(open ? assignment.id : null)}
                  onMove={(open) => setMoving(open ? assignment.id : null)}
                  onRemove={() => setToRemove(assignment)}
                  onChange={change}
                />
              ))}
            </tbody>
          </Table>
        </div>
      )}

      {toRemove && (
        <ConfirmDialog
          title="Remove assignment"
          message={`Remove connector "${connectorLabel(toRemove)}" from ${agent}? Its scheduled scans stop.`}
          confirmLabel="Remove assignment"
          loading={removing}
          onConfirm={() => void handleRemove()}
          onCancel={() => setToRemove(null)}
        />
      )}
    </section>
  )
}

type ChangeAction = (action: () => Promise<unknown>, failure: string) => Promise<boolean>

function AssignForm({ agent, connectors, onAssign }: { agent: string; connectors: Connector[]; onAssign: ChangeAction }) {
  const [connectorId, setConnectorId] = useState('')
  const [schedule, setSchedule] = useState('*/5 * * * *')
  const [enabled, setEnabled] = useState(true)
  const [error, setError] = useState('')
  const [assigning, setAssigning] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const id = Number(connectorId)
    if (!connectorId || Number.isNaN(id)) {
      setError('Select a connector')
      return
    }
    if (!schedule.trim()) {
      setError('Schedule is required')
      return
    }
    setError('')
    setAssigning(true)
    const done = await onAssign(
      () => assignConnector(agent, { connectorId: id, schedule: schedule.trim(), enabled }),
      'Failed to assign connector',
    )
    setAssigning(false)
    if (done) setConnectorId('')
  }

  return (
    <form onSubmit={handleSubmit} className="assign-form">
      <FormField label="Connector" hint={connectors.length === 0 ? 'No connectors defined yet' : undefined}>
        <select className={inputClass} value={connectorId} onChange={(e) => setConnectorId(e.target.value)}>
          <option value="">Select a connector</option>
          {connectors.map((connector) => (
            <option key={connector.id} value={connector.id}>
              {connector.label || connector.name} ({connector.name})
            </option>
          ))}
        </select>
      </FormField>
      <FormField label="Schedule (cron)" hint={CRON_HINT}>
        <input
          className={`${inputClass} mono`}
          value={schedule}
          onChange={(e) => setSchedule(e.target.value)}
          placeholder="*/5 * * * *"
        />
      </FormField>
      <label className="form-check">
        <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
        Enabled
      </label>
      <Button type="submit" variant="primary" disabled={assigning} aria-busy={assigning}>
        {assigning ? 'Assigning...' : 'Assign connector'}
      </Button>
      {error && (
        <p className="alert basis-full" role="alert">
          {error}
        </p>
      )}
    </form>
  )
}

interface AssignmentRowProps {
  agent: string
  assignment: AgentAssignment
  editing: boolean
  moving: boolean
  moveTargets: string[]
  onEdit: (open: boolean) => void
  onMove: (open: boolean) => void
  onRemove: () => void
  onChange: ChangeAction
}

function AssignmentRow({ agent, assignment, editing, moving, moveTargets, onEdit, onMove, onRemove, onChange }: AssignmentRowProps) {
  const { run, start, reset } = useCommandRun(agent)
  const status = assignmentStatus(assignment.lastStatus)
  const label = connectorLabel(assignment)
  const busy = isRunPending(run)

  function runNow() {
    void start(async () => (await runAgentAssignment(agent, assignment.connectorId)).data.id, 'Failed to run connector')
  }

  return (
    <>
      <tr>
        <td>
          <div className="cell-stack">
            <span className="font-semibold">{label}</span>
            <span className="cell-sub">{assignment.connector.name}</span>
          </div>
        </td>
        <td>
          {editing ? (
            <ScheduleEditor
              initial={assignment.schedule}
              onCancel={() => onEdit(false)}
              onSave={async (schedule) => {
                const done = await onChange(
                  () => updateAgentAssignment(agent, assignment.connectorId, { schedule }),
                  'Failed to update schedule',
                )
                if (done) onEdit(false)
              }}
            />
          ) : (
            <Tooltip tip="Edit schedule" describe={false}>
              <button type="button" className="cell-edit mono" aria-label={`Edit schedule of ${label}`} onClick={() => onEdit(true)}>
                {assignment.schedule}
              </button>
            </Tooltip>
          )}
        </td>
        <td>
          <button
            type="button"
            role="switch"
            className="switch"
            aria-checked={assignment.enabled}
            aria-label={`Enable ${label}`}
            onClick={() =>
              void onChange(
                () => updateAgentAssignment(agent, assignment.connectorId, { enabled: !assignment.enabled }),
                'Failed to update assignment',
              )
            }
          />
        </td>
        <td>
          <div className="cell-stack">
            <span className="status">
              <StatusLed state={status.led} />
              {status.label}
            </span>
            {assignment.lastError && <span className="cell-err">{assignment.lastError}</span>}
          </div>
        </td>
        <td className="text-fg-2">{assignment.lastRunAt ? timeAgo(assignment.lastRunAt) : <span className="cell-muted">Never</span>}</td>
        <td className="mono text-fg-2">
          {assignment.nextRunAt ? formatTimestamp(assignment.nextRunAt) : <span className="cell-muted">None</span>}
        </td>
        <td>
          <div className="row-actions">
            <Button onClick={runNow} disabled={busy} aria-busy={busy} aria-label={`Run ${label} now`}>
              {busy ? 'Running...' : 'Run now'}
            </Button>
            <Button variant="ghost" aria-label={`Move ${label} to another agent`} onClick={() => onMove(!moving)}>
              Move
            </Button>
            <Button variant="danger" aria-label={`Remove ${label}`} onClick={onRemove}>
              Remove
            </Button>
          </div>
        </td>
      </tr>
      {moving && (
        <tr className="subrow">
          <td colSpan={COLUMNS}>
            <MoveForm
              targets={moveTargets}
              onCancel={() => onMove(false)}
              onMove={async (toAgent) => {
                const done = await onChange(
                  () => moveAgentAssignment(agent, assignment.connectorId, toAgent),
                  'Failed to move assignment',
                )
                if (done) onMove(false)
              }}
            />
          </td>
        </tr>
      )}
      {run.status !== 'idle' && (
        <tr className="subrow">
          <td colSpan={COLUMNS}>
            <RunFeedback run={run} onDismiss={reset} />
          </td>
        </tr>
      )}
    </>
  )
}

function ScheduleEditor({
  initial,
  onSave,
  onCancel,
}: {
  initial: string
  onSave: (schedule: string) => Promise<void>
  onCancel: () => void
}) {
  const [value, setValue] = useState(initial)
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const trimmed = value.trim()
    if (!trimmed) return
    setSaving(true)
    await onSave(trimmed)
    setSaving(false)
  }

  return (
    <form className="inline-form" onSubmit={handleSubmit}>
      <input
        className={`${inputClass} mono w-36`}
        aria-label="Schedule (cron)"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        autoFocus
      />
      <Button type="submit" variant="primary" disabled={saving} aria-busy={saving}>
        {saving ? 'Saving...' : 'Save'}
      </Button>
      <Button onClick={onCancel}>Cancel</Button>
    </form>
  )
}

function MoveForm({
  targets,
  onMove,
  onCancel,
}: {
  targets: string[]
  onMove: (toAgent: string) => Promise<void>
  onCancel: () => void
}) {
  const [toAgent, setToAgent] = useState('')

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (toAgent) void onMove(toAgent)
  }

  return (
    <form className="inline-form" onSubmit={handleSubmit}>
      <span className="text-fg-2">Move to agent</span>
      <select className={inputClass} aria-label="Target agent" value={toAgent} onChange={(e) => setToAgent(e.target.value)}>
        <option value="">{targets.length === 0 ? 'No other agent connected' : 'Select an agent'}</option>
        {targets.map((name) => (
          <option key={name} value={name}>
            {name}
          </option>
        ))}
      </select>
      <Button type="submit" variant="primary" disabled={!toAgent}>
        Move
      </Button>
      <Button onClick={onCancel}>Cancel</Button>
    </form>
  )
}
