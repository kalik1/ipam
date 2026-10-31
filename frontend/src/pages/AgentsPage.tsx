import { useCallback, useEffect, useMemo, useState } from 'react'
import api, { getConnectors, getErrorMessage } from '@/lib/api'
import { agentRows, withHeartbeat } from '@/lib/agentRows'
import { timeAgo } from '@/lib/format'
import { useLive, useLiveEvent } from '@/lib/live'
import type { Agent, Connector } from '@/types'
import { Button } from '@/components/Button'
import { EmptyState } from '@/components/EmptyState'
import { Panel, PanelHeader } from '@/components/Panel'
import { Table, TableMessage } from '@/components/Table'
import { AgentLed, AgentPanel } from '@/components/agents/AgentPanel'
import { PageActions } from '@/components/shell/PageActions'

const COLUMNS = 6

export default function AgentsPage() {
  const live = useLive()
  const [baselines] = useState(() => new Map(live.agents.map((agent) => [agent.name, agent.heartbeats])))
  const [agents, setAgents] = useState<Agent[]>([])
  const [connectors, setConnectors] = useState<Connector[]>([])
  const [loaded, setLoaded] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [revision, setRevision] = useState(0)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [{ data: agentList }, { data: connectorList }] = await Promise.all([api.get<Agent[]>('/agents'), getConnectors()])
      setAgents(agentList)
      setConnectors(connectorList)
      setRevision((value) => value + 1)
      setError('')
    } catch (e) {
      setError(getErrorMessage(e, 'Failed to load agents'))
    } finally {
      setLoading(false)
      setLoaded(true)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  useLiveEvent((event) => {
    if (event.type === 'agent.heartbeat') setAgents((list) => withHeartbeat(list, event.data.agent, event.data.at))
    if (event.type === 'agent.connected') void load()
  })

  const rows = useMemo(() => (loaded ? agentRows(agents, live.agents, baselines) : []), [loaded, agents, live.agents, baselines])
  const connected = rows.filter((row) => row.connected).map((row) => row.name)

  return (
    <>
      <PageActions>
        <Button onClick={() => void load()} disabled={loading} aria-busy={loading}>
          Refresh
        </Button>
      </PageActions>

      {error && (
        <p className="alert" role="alert">
          {error}
        </p>
      )}

      <Panel aria-label="Agents">
        <PanelHeader title="Agents">
          <span className="list-count">{loaded ? `${connected.length} connected` : 'Loading'}</span>
        </PanelHeader>
        <Table>
          <thead>
            <tr>
              <th>Status</th>
              <th>Agent</th>
              <th>Platform</th>
              <th>Connectors</th>
              <th>Connected</th>
              <th>Last heartbeat</th>
            </tr>
          </thead>
          <tbody>
            {!loaded ? (
              <TableMessage colSpan={COLUMNS}>Loading agents...</TableMessage>
            ) : rows.length === 0 ? (
              <TableMessage colSpan={COLUMNS}>
                <EmptyState
                  title="No agents connected"
                  message="Agents appear here when they connect to IPAM over WebSocket with an API key"
                />
              </TableMessage>
            ) : (
              rows.map((row) => (
                <tr key={row.name}>
                  <td>
                    <span className="status">
                      <AgentLed agent={row} />
                      {row.connected ? 'Connected' : 'Disconnected'}
                    </span>
                  </td>
                  <td className="font-semibold">{row.name}</td>
                  <td className="text-fg-2">{row.platform || <span className="cell-muted">Not reported</span>}</td>
                  <td>
                    {row.connectors.length === 0 ? (
                      <span className="cell-muted">None</span>
                    ) : (
                      <span className="tags">
                        {row.connectors.map((name) => (
                          <span key={name} className="tag">
                            {name}
                          </span>
                        ))}
                      </span>
                    )}
                  </td>
                  <td className="text-fg-2">{row.connectedAt ? timeAgo(row.connectedAt) : <span className="cell-muted">Unknown</span>}</td>
                  <td className="text-fg-2">
                    {row.lastHeartbeatAt ? timeAgo(row.lastHeartbeatAt) : <span className="cell-muted">Unknown</span>}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </Table>
      </Panel>

      {rows.map((row) => (
        <AgentPanel
          key={row.name}
          agent={row}
          connectors={connectors}
          moveTargets={connected.filter((name) => name !== row.name)}
          revision={revision}
          onChanged={() => void load()}
        />
      ))}
    </>
  )
}
