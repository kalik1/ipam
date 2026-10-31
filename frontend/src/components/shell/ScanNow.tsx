import { useEffect, useMemo, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { getAgentAssignments, getErrorMessage, runAgentAssignment } from '@/lib/api'
import { cx } from '@/lib/cx'
import { useLive } from '@/lib/live'
import { scanFailures, scanNowView, scanTargets, type ScanProblem, type ScanTarget } from '@/lib/scanNow'
import type { AgentAssignment } from '@/types'
import { Button } from '@/components/Button'
import { StatusLed } from '@/components/StatusLed'

const STATUS_ID = 'scan-now-status'

async function loadAssignments(agents: string[]): Promise<AgentAssignment[]> {
  const lists = await Promise.allSettled(agents.map((agent) => getAgentAssignments(agent)))
  return lists.flatMap((list) => (list.status === 'fulfilled' ? list.value.data : []))
}

async function runTargets(targets: ScanTarget[]): Promise<ScanProblem[]> {
  const runs = await Promise.allSettled(targets.map((target) => runAgentAssignment(target.agent, target.connectorId)))
  return runs.flatMap((run, index) => {
    if (run.status === 'fulfilled') return []
    const { agent, connectorId, label } = targets[index]
    return [{ key: `run-${agent}-${connectorId}`, text: `${label} on ${agent}: ${getErrorMessage(run.reason, 'Failed to run connector')}` }]
  })
}

export function ScanNow() {
  const live = useLive()
  const { pathname } = useLocation()
  const connectedKey = live.agents
    .filter((agent) => agent.connected)
    .map((agent) => agent.name)
    .join('\n')
  const connected = useMemo(() => (connectedKey ? connectedKey.split('\n') : []), [connectedKey])
  const [assignments, setAssignments] = useState<AgentAssignment[] | null>(null)
  const [starting, setStarting] = useState(false)
  const [runErrors, setRunErrors] = useState<ScanProblem[]>([])
  const [dismissedSeq, setDismissedSeq] = useState(0)

  useEffect(() => {
    let active = true
    void loadAssignments(connected).then((list) => {
      if (active) setAssignments(list)
    })
    return () => {
      active = false
    }
  }, [connected, pathname])

  const view = scanNowView({
    agentsLoaded: live.agentsLoaded,
    connected,
    assignments,
    pending: Object.values(live.pending),
    starting,
  })
  const problems = [...runErrors, ...scanFailures(live.failures, dismissedSeq)]

  function dismiss() {
    setRunErrors([])
    setDismissedSeq(live.received)
  }

  async function scanNow() {
    if (view.blocked) return
    dismiss()
    setStarting(true)
    try {
      const fresh = await loadAssignments(connected)
      setAssignments(fresh)
      setRunErrors(await runTargets(scanTargets(connected, fresh)))
    } finally {
      setStarting(false)
    }
  }

  return (
    <div className="scan-now">
      <span id={STATUS_ID} className="scanpill" role="status">
        {view.status && (
          <>
            <StatusLed state={view.status.led} />
            {view.status.text}
          </>
        )}
      </span>
      <Button
        variant="primary"
        aria-disabled={view.blocked || undefined}
        aria-busy={view.busy || undefined}
        aria-describedby={view.status ? STATUS_ID : undefined}
        onClick={() => void scanNow()}
      >
        <span className={cx('lamp', view.lamp && 'busy')} aria-hidden="true" />
        {view.label}
      </Button>
      {problems.length > 0 && (
        <div className="scan-pop panel" role="alert">
          <p className="scan-pop-title">
            <StatusLed state="error" />
            {problems.length === 1 ? 'A scan failed' : `${problems.length} scans failed`}
          </p>
          <ul className="scan-pop-list">
            {problems.map((problem) => (
              <li key={problem.key}>{problem.text}</li>
            ))}
          </ul>
          <Button variant="ghost" onClick={dismiss}>
            Dismiss
          </Button>
        </div>
      )}
    </div>
  )
}
