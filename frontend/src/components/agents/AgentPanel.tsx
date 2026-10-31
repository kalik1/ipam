import { useEffect, useState } from 'react'
import { getAgentAssignments } from '@/lib/api'
import type { AgentRow } from '@/lib/agentRows'
import { timeAgo } from '@/lib/format'
import { blinkClass } from '@/lib/liveState'
import type { AgentAssignment, Connector } from '@/types'
import { Panel } from '@/components/Panel'
import { StatusLed } from '@/components/StatusLed'
import { AdHocRun } from './AdHocRun'
import { AssignmentsSection } from './AssignmentsSection'

export function AgentLed({ agent, labelled = false }: { agent: AgentRow; labelled?: boolean }) {
  return (
    <StatusLed
      state={agent.connected ? 'on' : 'error'}
      label={labelled ? (agent.connected ? 'Connected' : 'Disconnected') : undefined}
      className={blinkClass(agent.heartbeats, 'hb')}
    />
  )
}

function connectionSummary(agent: AgentRow): string {
  if (!agent.connected) return 'Disconnected'
  const parts = [agent.connectedAt ? `connected ${timeAgo(agent.connectedAt)}` : 'connected']
  if (agent.lastHeartbeatAt) parts.push(`last heartbeat ${timeAgo(agent.lastHeartbeatAt)}`)
  const text = parts.join(', ')
  return text.charAt(0).toUpperCase() + text.slice(1)
}

interface AgentPanelProps {
  agent: AgentRow
  connectors: Connector[]
  moveTargets: string[]
  revision: number
  onChanged: () => void
}

export function AgentPanel({ agent, connectors, moveTargets, revision, onChanged }: AgentPanelProps) {
  const [assignments, setAssignments] = useState<AgentAssignment[]>([])

  useEffect(() => {
    let cancelled = false
    getAgentAssignments(agent.name)
      .then(({ data }) => {
        if (!cancelled) setAssignments(data)
      })
      .catch(() => {
        if (!cancelled) setAssignments([])
      })
    return () => {
      cancelled = true
    }
  }, [agent.name, revision])

  return (
    <Panel aria-label={`Agent ${agent.name}`}>
      <div className="panel-head agent-head">
        <AgentLed agent={agent} labelled />
        <h2 className="panel-title">{agent.name}</h2>
        {agent.platform && <span className="tag">{agent.platform}</span>}
        <span className="agent-meta">{connectionSummary(agent)}</span>
      </div>
      <AssignmentsSection
        agent={agent.name}
        connectors={connectors}
        assignments={assignments}
        moveTargets={moveTargets}
        onChanged={onChanged}
      />
      <AdHocRun agent={agent} />
    </Panel>
  )
}
