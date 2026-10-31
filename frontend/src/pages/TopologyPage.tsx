import { useEffect, useState } from 'react'
import api, { getErrorMessage } from '@/lib/api'
import { statusCounts, type StatusFilter } from '@/lib/deviceList'
import { buildTopologyTree, type TopologyBranch } from '@/lib/topology'
import type { Subnet, Topology } from '@/types'
import { EmptyState } from '@/components/EmptyState'
import { Panel } from '@/components/Panel'
import { Selector } from '@/components/Selector'
import { StatusLed } from '@/components/StatusLed'
import { TopologyTree } from '@/components/topology/TopologyTree'

type LoadState = { status: 'loading' } | { status: 'ready'; branches: TopologyBranch[] } | { status: 'error'; message: string }

const STATUS_LABELS: Record<StatusFilter, string> = { all: 'All', online: 'Online', offline: 'Offline' }

function useTopologyTree(): LoadState {
  const [state, setState] = useState<LoadState>({ status: 'loading' })
  useEffect(() => {
    let active = true
    Promise.all([api.get<Topology>('/topology'), api.get<Subnet[]>('/subnets')])
      .then(([topology, subnets]) => {
        if (active) setState({ status: 'ready', branches: buildTopologyTree(topology.data, subnets.data) })
      })
      .catch((error: unknown) => {
        if (active) setState({ status: 'error', message: getErrorMessage(error, 'Failed to load the topology') })
      })
    return () => {
      active = false
    }
  }, [])
  return state
}

function TopologyBar({ branches, status, onStatus }: { branches: TopologyBranch[]; status: StatusFilter; onStatus: (status: StatusFilter) => void }) {
  const subnets = branches.flatMap((branch) => branch.subnets)
  const counts = statusCounts(subnets.flatMap((subnet) => subnet.ports.map((port) => port.device)))
  const options = (Object.keys(STATUS_LABELS) as StatusFilter[]).map((value) => ({ value, label: STATUS_LABELS[value], count: counts[value] }))
  return (
    <Panel className="topo-bar" aria-label="Topology summary">
      <h2 className="panel-title">VLANs, subnets and devices</h2>
      <span className="topo-totals">
        <b>{branches.length}</b> {branches.length === 1 ? 'VLAN' : 'VLANs'}
        <b>{subnets.length}</b> {subnets.length === 1 ? 'subnet' : 'subnets'}
        <b>{counts.all}</b> {counts.all === 1 ? 'device' : 'devices'}
      </span>
      <Selector label="Show devices" options={options} value={status} onChange={onStatus} />
      <span className="legend topo-legend">
        <span className="lg">
          <StatusLed state="on" />
          Online
        </span>
        <span className="lg">
          <StatusLed state="off" />
          Offline
        </span>
        <span className="lg">
          <span className="sw gw" />
          Gateway
        </span>
        <span className="lg">
          <span className="sw pool" />
          DHCP pool
        </span>
      </span>
    </Panel>
  )
}

export default function TopologyPage() {
  const state = useTopologyTree()
  const [status, setStatus] = useState<StatusFilter>('all')

  if (state.status === 'loading') return <p className="text-fg-3">Loading topology...</p>
  if (state.status === 'error') return <p className="alert">{state.message}</p>
  return (
    <div className="topology-page">
      <TopologyBar branches={state.branches} status={status} onStatus={setStatus} />
      {state.branches.length === 0 ? (
        <Panel>
          <EmptyState title="No VLANs or subnets yet" message="Add a VLAN or a subnet to see the topology here" />
        </Panel>
      ) : (
        <TopologyTree branches={state.branches} status={status} />
      )}
    </div>
  )
}
