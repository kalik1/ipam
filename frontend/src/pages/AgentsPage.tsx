import { useCallback, useEffect, useState, type FormEvent } from 'react'
import api, {
  assignConnector,
  deleteAgentAssignment,
  getAgentAssignments,
  getConnectors,
  getErrorMessage,
  moveAgentAssignment,
  runAgentAssignment,
  updateAgentAssignment,
} from '@/lib/api'
import { timeAgo } from '@/lib/format'
import { CONNECTOR_FIELDS } from '@/lib/connectors'
import type { Agent, AgentAssignment, AgentResult, AssignmentStatus, Connector } from '@/types'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { EmptyState } from '@/components/EmptyState'
import { FormField, inputClass } from '@/components/FormField'

const POLL_INTERVAL_MS = 2500
const POLL_TIMEOUT_MS = 30_000
const CRON_HINT = 'Common: */5 * * * * (5 min), 0 * * * * (hourly), 0 0 * * * (daily)'

export default function AgentsPage() {
  const [agents, setAgents] = useState<Agent[]>([])
  const [connectors, setConnectors] = useState<Connector[]>([])
  const [assignments, setAssignments] = useState<Record<string, AgentAssignment[]>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const fetchAssignments = useCallback(async (agentList: Agent[]) => {
    const entries = await Promise.all(
      agentList.map(async (agent) => {
        try {
          const { data } = await getAgentAssignments(agent.name)
          return [agent.name, data] as const
        } catch {
          return [agent.name, [] as AgentAssignment[]] as const
        }
      }),
    )
    setAssignments(Object.fromEntries(entries))
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [{ data: agentList }, { data: connectorList }] = await Promise.all([
        api.get<Agent[]>('/agents'),
        getConnectors(),
      ])
      setAgents(agentList)
      setConnectors(connectorList)
      await fetchAssignments(agentList)
      setError('')
    } catch (e) {
      setError(getErrorMessage(e, 'Failed to load agents'))
    } finally {
      setLoading(false)
    }
  }, [fetchAssignments])

  const refresh = useCallback(async () => {
    try {
      const { data: agentList } = await api.get<Agent[]>('/agents')
      setAgents(agentList)
      await fetchAssignments(agentList)
      setError('')
    } catch (e) {
      setError(getErrorMessage(e, 'Failed to refresh agents'))
    }
  }, [fetchAssignments])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm text-slate-400">Agents connected via WebSocket</p>
        <button onClick={() => void load()} className="btn btn-secondary">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden="true">
            <path d="M21 12a9 9 0 1 1-2.64-6.36M21 3v6h-6" />
          </svg>
          Refresh
        </button>
      </div>

      {error && (
        <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">{error}</p>
      )}

      <div className="card overflow-hidden">
        <table className="w-full text-left">
          <thead className="border-b border-slate-800">
            <tr>
              <th className="th">Name</th>
              <th className="th">Platform</th>
              <th className="th">Connectors</th>
              <th className="th">Connected</th>
              <th className="th">Last ping</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {loading ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                  Loading...
                </td>
              </tr>
            ) : agents.length === 0 ? (
              <tr>
                <td colSpan={5}>
                  <EmptyState title="No agents connected" message="Agents will appear here when they connect via WebSocket" />
                </td>
              </tr>
            ) : (
              agents.map((agent) => (
                <tr key={agent.name} className="transition-colors hover:bg-slate-800/40">
                  <td className="td font-medium text-slate-200">{agent.name}</td>
                  <td className="td">{agent.platform || '—'}</td>
                  <td className="td">
                    <div className="flex flex-wrap gap-1.5">
                      {agent.connectors.length === 0 ? (
                        <span>—</span>
                      ) : (
                        agent.connectors.map((connector) => (
                          <span key={connector} className="rounded-md bg-slate-800 px-2 py-0.5 text-xs text-slate-300">
                            {connector}
                          </span>
                        ))
                      )}
                    </div>
                  </td>
                  <td className="td">{timeAgo(agent.connectedAt)}</td>
                  <td className="td">{timeAgo(agent.lastPingAt)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {agents.map((agent) => (
        <AssignmentsCard
          key={`assignments-${agent.name}`}
          agent={agent}
          connectors={connectors}
          assignments={assignments[agent.name] ?? []}
          otherAgents={agents.filter((a) => a.name !== agent.name)}
          onRefresh={() => void refresh()}
        />
      ))}

      {agents.map((agent) => (
        <ConnectorPanel key={`panel-${agent.name}`} agent={agent} />
      ))}
    </div>
  )
}

const STATUS_STYLES: Record<AssignmentStatus, string> = {
  ok: 'bg-emerald-500/10 text-emerald-400 ring-emerald-500/30',
  error: 'bg-red-500/10 text-red-400 ring-red-500/30',
  skipped: 'bg-amber-500/10 text-amber-400 ring-amber-500/30',
  sent: 'bg-sky-500/10 text-sky-400 ring-sky-500/30',
}

function StatusBadge({ status }: { status: AssignmentStatus | null }) {
  if (!status) return <span className="text-slate-500">—</span>
  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${STATUS_STYLES[status]}`}>
      {status}
    </span>
  )
}

interface RunEntry {
  status: 'sending' | 'waiting' | 'done' | 'timeout' | 'error'
  commandId?: string
  result?: AgentResult
  message?: string
}

function AssignmentsCard({
  agent,
  connectors,
  assignments,
  otherAgents,
  onRefresh,
}: {
  agent: Agent
  connectors: Connector[]
  assignments: AgentAssignment[]
  otherAgents: Agent[]
  onRefresh: () => void
}) {
  const [connectorId, setConnectorId] = useState('')
  const [schedule, setSchedule] = useState('*/5 * * * *')
  const [enabled, setEnabled] = useState(true)
  const [cardError, setCardError] = useState('')
  const [assigning, setAssigning] = useState(false)
  const [editing, setEditing] = useState<{ id: number; value: string } | null>(null)
  const [savingSchedule, setSavingSchedule] = useState(false)
  const [move, setMove] = useState<{ id: number; toAgent: string } | null>(null)
  const [toRemove, setToRemove] = useState<AgentAssignment | null>(null)
  const [removing, setRemoving] = useState(false)
  const [runs, setRuns] = useState<Record<number, RunEntry>>({})

  useEffect(() => {
    const waiting = Object.entries(runs).filter(([, entry]) => entry.status === 'waiting')
    if (waiting.length === 0) return
    const deadline = Date.now() + POLL_TIMEOUT_MS
    let cancelled = false
    let timer: number | undefined

    const poll = async () => {
      for (const [id, entry] of waiting) {
        if (entry.status !== 'waiting' || !entry.commandId) continue
        const key = Number(id)
        try {
          const { data } = await api.get<AgentResult>(`/agents/${agent.name}/results`)
          if (!cancelled && data.id === entry.commandId) {
            setRuns((prev) =>
              prev[key] ? { ...prev, [key]: { ...prev[key], status: 'done', result: data } } : prev,
            )
          }
        } catch {
          // no result yet: keep polling until deadline
        }
      }
      if (cancelled) return
      if (Date.now() >= deadline) {
        setRuns((prev) => {
          const next: Record<number, RunEntry> = {}
          for (const [key, entry] of Object.entries(prev)) {
            next[Number(key)] = entry.status === 'waiting' ? { status: 'timeout' } : entry
          }
          return next
        })
        return
      }
      timer = window.setTimeout(poll, POLL_INTERVAL_MS)
    }

    timer = window.setTimeout(poll, POLL_INTERVAL_MS)
    return () => {
      cancelled = true
      if (timer !== undefined) window.clearTimeout(timer)
    }
  }, [runs, agent.name])

  async function handleAssign(e: FormEvent) {
    e.preventDefault()
    const id = Number(connectorId)
    if (!connectorId || Number.isNaN(id)) {
      setCardError('Select a connector')
      return
    }
    if (!schedule.trim()) {
      setCardError('Schedule is required')
      return
    }
    setAssigning(true)
    setCardError('')
    try {
      await assignConnector(agent.name, { connectorId: id, schedule: schedule.trim(), enabled })
      setConnectorId('')
      onRefresh()
    } catch (err) {
      setCardError(getErrorMessage(err, 'Failed to assign connector'))
    } finally {
      setAssigning(false)
    }
  }

  async function handleToggle(assignment: AgentAssignment) {
    setCardError('')
    try {
      await updateAgentAssignment(agent.name, assignment.connectorId, { enabled: !assignment.enabled })
      onRefresh()
    } catch (err) {
      setCardError(getErrorMessage(err, 'Failed to update assignment'))
    }
  }

  async function handleSaveSchedule(assignment: AgentAssignment) {
    if (!editing) return
    const trimmed = editing.value.trim()
    if (!trimmed) return
    setSavingSchedule(true)
    setCardError('')
    try {
      await updateAgentAssignment(agent.name, assignment.connectorId, { schedule: trimmed })
      setEditing(null)
      onRefresh()
    } catch (err) {
      setCardError(getErrorMessage(err, 'Failed to update schedule'))
    } finally {
      setSavingSchedule(false)
    }
  }

  async function handleRun(assignment: AgentAssignment) {
    setRuns((prev) => ({ ...prev, [assignment.id]: { status: 'sending' } }))
    try {
      const { data } = await runAgentAssignment(agent.name, assignment.connectorId)
      setRuns((prev) => ({ ...prev, [assignment.id]: { status: 'waiting', commandId: data.id } }))
    } catch (err) {
      setRuns((prev) => ({
        ...prev,
        [assignment.id]: { status: 'error', message: getErrorMessage(err, 'Failed to run connector') },
      }))
    }
  }

  async function handleMove() {
    if (!move || !move.toAgent) return
    const connectorIdOfMove = assignments.find((a) => a.id === move.id)?.connectorId
    if (connectorIdOfMove === undefined) return
    setCardError('')
    try {
      await moveAgentAssignment(agent.name, connectorIdOfMove, move.toAgent)
      setMove(null)
      onRefresh()
    } catch (err) {
      setCardError(getErrorMessage(err, 'Failed to move assignment'))
    }
  }

  async function handleRemove() {
    if (!toRemove) return
    setRemoving(true)
    try {
      await deleteAgentAssignment(agent.name, toRemove.connectorId)
      setToRemove(null)
      onRefresh()
    } catch (err) {
      setCardError(getErrorMessage(err, 'Failed to remove assignment'))
      setToRemove(null)
    } finally {
      setRemoving(false)
    }
  }

  return (
    <section className="card p-5">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-sm font-semibold text-slate-200">Assignments — {agent.name}</h2>
        <span className="text-xs text-slate-500">
          {assignments.length} connector{assignments.length === 1 ? '' : 's'} scheduled
        </span>
      </div>

      <form onSubmit={handleAssign} className="mt-4 flex flex-col gap-4 md:flex-row md:items-end">
        <div className="min-w-48 flex-1">
          <FormField label="Connector">
            <select
              className={inputClass}
              value={connectorId}
              onChange={(e) => setConnectorId(e.target.value)}
            >
              <option value="">Select...</option>
              {connectors.map((connector) => (
                <option key={connector.id} value={connector.id}>
                  {connector.label || connector.name} ({connector.name})
                </option>
              ))}
            </select>
          </FormField>
          {connectors.length === 0 && (
            <span className="mt-1 block text-xs text-slate-500">No connectors defined yet</span>
          )}
        </div>
        <div className="min-w-48 flex-1">
          <FormField label="Schedule (cron)" hint={CRON_HINT}>
            <input
              className={inputClass}
              value={schedule}
              onChange={(e) => setSchedule(e.target.value)}
              placeholder="*/5 * * * *"
            />
          </FormField>
        </div>
        <div className="flex items-center gap-2 pb-2.5">
          <input
            id={`enabled-${agent.name}`}
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
            className="h-4 w-4 rounded border-slate-700 accent-indigo-500"
          />
          <label htmlFor={`enabled-${agent.name}`} className="text-sm text-slate-300">
            Enabled
          </label>
        </div>
        <div className="pb-0.5">
          <button type="submit" disabled={assigning} className="btn btn-primary">
            {assigning ? 'Assigning...' : 'Assign'}
          </button>
        </div>
      </form>

      {cardError && (
        <p className="mt-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-400">
          {cardError}
        </p>
      )}

      {assignments.length === 0 ? (
        <p className="mt-4 text-sm text-slate-500">No connectors assigned to this agent.</p>
      ) : (
        <div className="mt-4 overflow-hidden rounded-lg border border-slate-800">
          <table className="w-full text-left">
            <thead className="border-b border-slate-800 bg-slate-900/60">
              <tr>
                <th className="th">Connector</th>
                <th className="th">Schedule</th>
                <th className="th">Enabled</th>
                <th className="th">Last status</th>
                <th className="th">Last run</th>
                <th className="th">Next run</th>
                <th className="th text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {assignments.map((assignment) => {
                const run = runs[assignment.id]
                return (
                  <FragmentRow
                    key={assignment.id}
                    assignment={assignment}
                    run={run}
                    editing={editing}
                    move={move}
                    savingSchedule={savingSchedule}
                    otherAgents={otherAgents}
                    onToggle={() => handleToggle(assignment)}
                    onEditSchedule={() => setEditing({ id: assignment.id, value: assignment.schedule })}
                    onEditChange={(value) => setEditing({ id: assignment.id, value })}
                    onCancelEdit={() => setEditing(null)}
                    onSaveSchedule={() => handleSaveSchedule(assignment)}
                    onRun={() => handleRun(assignment)}
                    onOpenMove={() => setMove({ id: assignment.id, toAgent: '' })}
                    onMoveChange={(toAgent) => setMove({ id: assignment.id, toAgent })}
                    onCancelMove={() => setMove(null)}
                    onConfirmMove={() => handleMove()}
                    onRemove={() => setToRemove(assignment)}
                  />
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {assignments.some((a) => runs[a.id]?.status === 'done') && (
        <div className="mt-4 space-y-4">
          {assignments
            .filter((a) => runs[a.id]?.status === 'done')
            .map((a) => (
              <div key={a.id}>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Result — {a.connector.label || a.connector.name}
                </p>
                <ResultView result={runs[a.id]?.result ?? { id: '', ok: false, receivedAt: '' }} />
              </div>
            ))}
        </div>
      )}

      {toRemove && (
        <ConfirmDialog
          title="Remove assignment"
          message={`Remove connector "${toRemove.connector.label || toRemove.connector.name}" from ${agent.name}?`}
          loading={removing}
          onConfirm={handleRemove}
          onCancel={() => setToRemove(null)}
        />
      )}
    </section>
  )
}

function FragmentRow({
  assignment,
  run,
  editing,
  move,
  savingSchedule,
  otherAgents,
  onToggle,
  onEditSchedule,
  onEditChange,
  onCancelEdit,
  onSaveSchedule,
  onRun,
  onOpenMove,
  onMoveChange,
  onCancelMove,
  onConfirmMove,
  onRemove,
}: {
  assignment: AgentAssignment
  run: RunEntry | undefined
  editing: { id: number; value: string } | null
  move: { id: number; toAgent: string } | null
  savingSchedule: boolean
  otherAgents: Agent[]
  onToggle: () => void
  onEditSchedule: () => void
  onEditChange: (value: string) => void
  onCancelEdit: () => void
  onSaveSchedule: () => void
  onRun: () => void
  onOpenMove: () => void
  onMoveChange: (toAgent: string) => void
  onCancelMove: () => void
  onConfirmMove: () => void
  onRemove: () => void
}) {
  const isEditing = editing?.id === assignment.id
  const isMoving = move?.id === assignment.id
  const busy = run?.status === 'sending' || run?.status === 'waiting'
  return (
    <>
      <tr className="transition-colors hover:bg-slate-800/40">
        <td className="td">
          <div className="font-medium text-slate-200">{assignment.connector.label || assignment.connector.name}</div>
          <div className="text-xs text-slate-500">{assignment.connector.name}</div>
        </td>
        <td className="td font-mono text-xs">
          {isEditing ? (
            <div className="flex items-center gap-2">
              <input
                className={`${inputClass} w-36`}
                value={editing.value}
                onChange={(e) => onEditChange(e.target.value)}
              />
              <button type="button" onClick={onSaveSchedule} disabled={savingSchedule} className="btn btn-primary px-2 py-1 text-xs">
                {savingSchedule ? 'Saving...' : 'Save'}
              </button>
              <button type="button" onClick={onCancelEdit} className="btn btn-secondary px-2 py-1 text-xs">
                Cancel
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={onEditSchedule}
              title="Edit schedule"
              className="text-indigo-400 transition-colors hover:text-indigo-300"
            >
              {assignment.schedule}
            </button>
          )}
        </td>
        <td className="td">
          <button
            type="button"
            role="switch"
            aria-checked={assignment.enabled}
            onClick={onToggle}
            className={`relative h-5 w-9 rounded-full transition-colors ${assignment.enabled ? 'bg-indigo-500' : 'bg-slate-700'}`}
          >
            <span
              className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all ${assignment.enabled ? 'left-[18px]' : 'left-0.5'}`}
            />
          </button>
        </td>
        <td className="td">
          <StatusBadge status={assignment.lastStatus} />
        </td>
        <td className="td">{assignment.lastRunAt ? timeAgo(assignment.lastRunAt) : '—'}</td>
        <td className="td">{assignment.nextRunAt ? new Date(assignment.nextRunAt).toLocaleString() : '—'}</td>
        <td className="td">
          {assignment.lastError && <p className="mb-1 text-xs text-red-400">{assignment.lastError}</p>}
          <div className="flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onRun}
              disabled={busy}
              className="text-indigo-400 transition-colors hover:text-indigo-300 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Run now
            </button>
            <button type="button" onClick={onOpenMove} className="text-slate-300 transition-colors hover:text-slate-200">
              Move
            </button>
            <button type="button" onClick={onRemove} className="text-red-400 transition-colors hover:text-red-300">
              Remove
            </button>
          </div>
          {run?.status === 'waiting' && <span className="mt-1 block text-xs text-slate-500">Waiting for result...</span>}
          {run?.status === 'timeout' && (
            <span className="mt-1 block text-xs text-amber-400">No result received (timed out after 30s)</span>
          )}
          {run?.status === 'error' && <span className="mt-1 block text-xs text-red-400">{run.message}</span>}
        </td>
      </tr>
      {isMoving && (
        <tr className="bg-slate-900/60">
          <td colSpan={7} className="px-4 py-3">
            <div className="flex items-center gap-3">
              <span className="text-sm text-slate-400">Move to agent:</span>
              <select
                className={`${inputClass} w-40`}
                value={move.toAgent}
                onChange={(e) => onMoveChange(e.target.value)}
              >
                <option value="">Select agent...</option>
                {otherAgents.map((a) => (
                  <option key={a.name} value={a.name}>
                    {a.name}
                  </option>
                ))}
              </select>
              <button type="button" onClick={onConfirmMove} disabled={!move.toAgent} className="btn btn-primary px-3 py-1.5 text-xs">
                Move
              </button>
              <button type="button" onClick={onCancelMove} className="btn btn-secondary px-3 py-1.5 text-xs">
                Cancel
              </button>
            </div>
          </td>
        </tr>
      )}
    </>
  )
}

function ConnectorPanel({ agent }: { agent: Agent }) {
  const [selected, setSelected] = useState(agent.connectors[0] ?? '')
  const [fields, setFields] = useState<Record<string, string>>({})
  const [rawParams, setRawParams] = useState('')
  const [formError, setFormError] = useState('')
  const [runState, setRunState] = useState<RunState>({ status: 'idle' })

  const active = agent.connectors.includes(selected) ? selected : agent.connectors[0] ?? ''
  const fieldDefs = CONNECTOR_FIELDS[active]
  const isKnown = fieldDefs !== undefined

  useEffect(() => {
    if (fieldDefs) {
      const initial: Record<string, string> = {}
      for (const field of fieldDefs) initial[field.key] = field.default ?? ''
      setFields(initial)
    }
    setRawParams('')
  }, [active])

  useEffect(() => {
    if (runState.status !== 'waiting') return
    const deadline = Date.now() + POLL_TIMEOUT_MS
    let cancelled = false
    let timer: number | undefined

    const poll = async () => {
      try {
        const { data } = await api.get<AgentResult>(`/agents/${agent.name}/results`)
        if (!cancelled && data.id === runState.commandId) {
          setRunState({ status: 'done', result: data })
          return
        }
      } catch {
        // no result yet or stale result: keep polling until deadline
      }
      if (cancelled) return
      if (Date.now() >= deadline) {
        setRunState({ status: 'timeout' })
        return
      }
      timer = window.setTimeout(poll, POLL_INTERVAL_MS)
    }

    timer = window.setTimeout(poll, POLL_INTERVAL_MS)
    return () => {
      cancelled = true
      if (timer !== undefined) window.clearTimeout(timer)
    }
  }, [runState, agent.name])

  async function handleRun(e: FormEvent) {
    e.preventDefault()
    if (!active) {
      setFormError('Select a connector')
      return
    }
    let params: Record<string, unknown>
    if (fieldDefs) {
      params = {}
      for (const field of fieldDefs) {
        const value = (fields[field.key] ?? '').trim()
        if (!value) continue
        params[field.key] = field.type === 'number' ? Number(value) : value
      }
    } else {
      const trimmed = rawParams.trim()
      if (!trimmed) {
        setFormError('Params JSON is required')
        return
      }
      let parsed: unknown
      try {
        parsed = JSON.parse(trimmed)
      } catch {
        setFormError('Params must be valid JSON')
        return
      }
      if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
        setFormError('Params must be a JSON object')
        return
      }
      params = parsed as Record<string, unknown>
    }
    setFormError('')
    setRunState({ status: 'sending' })
    try {
      const { data } = await api.post<{ id: string }>(`/agents/${agent.name}/commands`, {
        action: 'run_connector',
        connector: active,
        params,
      })
      setRunState({ status: 'waiting', commandId: data.id })
    } catch (err) {
      setFormError(getErrorMessage(err, 'Failed to send command'))
      setRunState({ status: 'idle' })
    }
  }

  return (
    <section className="card p-5">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-sm font-semibold text-slate-200">Ad-hoc run — {agent.name}</h2>
        <span className="text-xs text-slate-500">
          {agent.connectors.length} connector{agent.connectors.length === 1 ? '' : 's'}
        </span>
      </div>
      {agent.connectors.length === 0 ? (
        <p className="mt-4 text-sm text-slate-500">This agent exposes no connectors.</p>
      ) : (
        <form onSubmit={handleRun} className="mt-4 space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <FormField label="Connector">
              <select
                className={inputClass}
                value={active}
                onChange={(e) => setSelected(e.target.value)}
              >
                {agent.connectors.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </FormField>
            {fieldDefs?.map((field) => (
              <FormField key={field.key} label={field.label}>
                <input
                  type={field.type === 'number' ? 'number' : field.type === 'password' ? 'password' : 'text'}
                  className={inputClass}
                  value={fields[field.key] ?? ''}
                  onChange={(e) => setFields((prev) => ({ ...prev, [field.key]: e.target.value }))}
                />
              </FormField>
            ))}
            {!isKnown && (
              <FormField label="Params (JSON)" hint="JSON object passed to the connector">
                <textarea
                  className={`${inputClass} min-h-24 font-mono`}
                  value={rawParams}
                  onChange={(e) => setRawParams(e.target.value)}
                  placeholder='{"host": "192.168.1.1"}'
                />
              </FormField>
            )}
          </div>
          {formError && (
            <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-400">{formError}</p>
          )}
          <div className="flex items-center gap-3">
            <button type="submit" disabled={runState.status === 'sending'} className="btn btn-primary">
              {runState.status === 'sending' ? 'Sending...' : 'Run'}
            </button>
            {runState.status === 'waiting' && (
              <span className="text-sm text-slate-500">Waiting for result...</span>
            )}
            {runState.status === 'timeout' && (
              <span className="text-sm text-amber-400">No result received (timed out after 30s)</span>
            )}
          </div>
          {runState.status === 'done' && <ResultView result={runState.result} />}
        </form>
      )}
    </section>
  )
}

type RunState =
  | { status: 'idle' }
  | { status: 'sending' }
  | { status: 'waiting'; commandId: string }
  | { status: 'done'; result: AgentResult }
  | { status: 'timeout' }

function ResultView({ result }: { result: AgentResult }) {
  if (!result.ok) {
    return (
      <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
        {result.error ?? 'Unknown error'}
      </div>
    )
  }
  const data = result.data ?? {}
  const devices = Array.isArray(data.devices) ? (data.devices as Record<string, unknown>[]) : []
  const vlans = Array.isArray(data.vlans) ? (data.vlans as Record<string, unknown>[]) : []
  const subnets = Array.isArray(data.subnets) ? (data.subnets as Record<string, unknown>[]) : []
  const meta = isRecord(data.meta) ? data.meta : undefined
  const vlanNames = new Map<number, string>()
  for (const vlan of vlans) {
    if (typeof vlan.vlanId === 'number') vlanNames.set(vlan.vlanId, String(vlan.name ?? ''))
  }
  const hasData = devices.length > 0 || vlans.length > 0 || subnets.length > 0 || meta !== undefined
  return (
    <div className="space-y-4">
      {devices.length > 0 && (
        <div className="card overflow-hidden">
          <table className="w-full text-left">
            <thead className="border-b border-slate-800">
              <tr>
                <th className="th">IP</th>
                <th className="th">MAC</th>
                <th className="th">Hostname</th>
                <th className="th">Vendor</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {devices.map((device, index) => (
                <tr key={String(device.ip ?? index)}>
                  <td className="td font-mono text-slate-200">{describeValue(device.ip)}</td>
                  <td className="td font-mono">{describeValue(device.mac)}</td>
                  <td className="td">{describeValue(device.hostname)}</td>
                  <td className="td">{describeValue(device.vendor)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {subnets.length > 0 && (
        <div className="card overflow-hidden">
          <table className="w-full text-left">
            <thead className="border-b border-slate-800">
              <tr>
                <th className="th">CIDR</th>
                <th className="th">Name</th>
                <th className="th">Gateway</th>
                <th className="th">VLAN</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {subnets.map((subnet, index) => (
                <tr key={String(subnet.cidr ?? index)}>
                  <td className="td font-mono text-slate-200">{describeValue(subnet.cidr)}</td>
                  <td className="td">{describeValue(subnet.name)}</td>
                  <td className="td font-mono">{describeValue(subnet.gateway)}</td>
                  <td className="td">{describeVlan(subnet.vlanId, vlanNames)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {vlans.length > 0 && (
        <div className="card overflow-hidden">
          <table className="w-full text-left">
            <thead className="border-b border-slate-800">
              <tr>
                <th className="th">VLAN ID</th>
                <th className="th">Name</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {vlans.map((vlan, index) => (
                <tr key={String(vlan.vlanId ?? index)}>
                  <td className="td font-mono text-slate-200">{describeValue(vlan.vlanId)}</td>
                  <td className="td">{describeValue(vlan.name)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {meta ? <MetaView meta={meta} /> : !hasData && (
        <p className="text-sm text-slate-500">No data returned</p>
      )}
    </div>
  )
}

function describeVlan(vlanId: unknown, vlanNames: Map<number, string>): string {
  if (typeof vlanId !== 'number') return '—'
  return vlanNames.get(vlanId) ?? String(vlanId)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function describeValue(value: unknown): string {
  if (value === undefined || value === null) return '—'
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

function MetaView({ meta }: { meta: Record<string, unknown> }) {
  return (
    <div className="space-y-4">
      {Object.entries(meta).map(([key, value]) => (
        <div key={key}>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">{key}</h3>
          {Array.isArray(value) && value.length > 0 && value.every(isRecord) ? (
            <ObjectArrayTable rows={value} />
          ) : isRecord(value) ? (
            <KeyValueTable entries={Object.entries(value)} />
          ) : (
            <p className="text-sm text-slate-300">{describeValue(value)}</p>
          )}
        </div>
      ))}
    </div>
  )
}

function ObjectArrayTable({ rows }: { rows: Record<string, unknown>[] }) {
  const columns = Array.from(new Set(rows.flatMap((row) => Object.keys(row))))
  return (
    <div className="card overflow-hidden">
      <table className="w-full text-left">
        <thead className="border-b border-slate-800">
          <tr>
            {columns.map((column) => (
              <th key={column} className="th">{column}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800/60">
          {rows.map((row, index) => (
            <tr key={index}>
              {columns.map((column) => (
                <td key={column} className="td">{describeValue(row[column])}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function KeyValueTable({ entries }: { entries: [string, unknown][] }) {
  return (
    <div className="card overflow-hidden">
      <table className="w-full text-left">
        <tbody className="divide-y divide-slate-800/60">
          {entries.map(([key, value]) => (
            <tr key={key}>
              <td className="td w-48 font-medium text-slate-300">{key}</td>
              <td className="td">{describeValue(value)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
