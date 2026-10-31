import { Link } from 'react-router-dom'
import type { AgentRow } from '@/lib/agentRows'
import { cx } from '@/lib/cx'
import { connectorRun, describeSchedule, type RunOverlay } from '@/lib/discovery'
import { timeAgo } from '@/lib/format'
import type { AgentAssignment } from '@/types'
import { Panel } from '@/components/Panel'
import { StatusLed } from '@/components/StatusLed'
import { AgentLed } from '@/components/agents/AgentPanel'

function agentSummary(agent: AgentRow): string {
  const parts = agent.platform ? [agent.platform] : []
  if (!agent.connected) return [...parts, 'disconnected'].join(', ')
  parts.push(agent.connectedAt ? `connected ${timeAgo(agent.connectedAt)}` : 'connected')
  if (agent.lastHeartbeatAt) parts.push(`last heartbeat ${timeAgo(agent.lastHeartbeatAt)}`)
  return parts.join(', ')
}

function ConnectorRow({ assignment, overlay }: { assignment: AgentAssignment; overlay: RunOverlay }) {
  const run = connectorRun(assignment, overlay)
  return (
    <div className="conn">
      <StatusLed state={run.led} />
      <span className="n">{assignment.connector.label || assignment.connector.name}</span>
      <span className="when">{assignment.enabled ? describeSchedule(assignment.schedule) : 'disabled'}</span>
      <span className={cx('msg', run.error && 'err')}>{run.text}</span>
    </div>
  )
}

function AgentConnectors({ assignments, overlay }: { assignments: AgentAssignment[] | undefined; overlay: RunOverlay }) {
  if (!assignments) return <p className="conn-note">Loading connectors...</p>
  if (assignments.length === 0) return <p className="conn-note">No connectors assigned</p>
  return (
    <>
      {assignments.map((assignment) => (
        <ConnectorRow key={assignment.id} assignment={assignment} overlay={overlay} />
      ))}
    </>
  )
}

interface DiscoveryPanelProps {
  loaded: boolean
  error: string
  agents: AgentRow[]
  assignments: ReadonlyMap<string, AgentAssignment[]>
  overlay: RunOverlay
}

export function DiscoveryPanel({ loaded, error, agents, assignments, overlay }: DiscoveryPanelProps) {
  return (
    <Panel className="box" aria-label="Discovery">
      <div className="boxhead">
        <h2 className="panel-title">Discovery</h2>
        <Link className="r" to="/agents">
          Agents and their connectors
        </Link>
      </div>
      {error && <p className="box-note err">{error}</p>}
      {!loaded ? (
        <p className="box-note">Loading agents...</p>
      ) : agents.length === 0 ? (
        <p className="box-note">No agent connected. Agents appear here when they connect with an API key.</p>
      ) : (
        agents.map((agent) => (
          <div key={agent.name} className="asg">
            <div className="asgtop">
              <AgentLed agent={agent} labelled />
              <b>{agent.name}</b>
              <span className="pf">{agentSummary(agent)}</span>
            </div>
            <AgentConnectors assignments={assignments.get(agent.name)} overlay={overlay} />
          </div>
        ))
      )}
    </Panel>
  )
}
