import { useMemo } from 'react'
import { latestScans, wentOffline } from '@/lib/dashboard'
import { useLive } from '@/lib/live'
import { pulseClass } from '@/lib/liveState'
import { buildRack } from '@/lib/rack'
import { DiscoveryPanel } from '@/components/dashboard/DiscoveryPanel'
import { LatestScansPanel } from '@/components/dashboard/LatestScansPanel'
import { NetworkSummary } from '@/components/dashboard/NetworkSummary'
import { RackPanel } from '@/components/dashboard/RackPanel'
import { useDiscovery, useNetwork, useScanReports } from '@/components/dashboard/useDashboardData'
import { WentOfflinePanel } from '@/components/dashboard/WentOfflinePanel'

const OFFLINE_LIMIT = 8
const SCANS_LIMIT = 8

export default function DashboardPage() {
  const live = useLive()
  const network = useNetwork()
  const reports = useScanReports(SCANS_LIMIT)
  const discovery = useDiscovery()

  const branches = network.status === 'ready' ? network.data.branches : null
  const devices = network.status === 'ready' ? network.data.devices : null
  const rack = useMemo(() => (branches ? buildRack(branches) : null), [branches])
  const offline = useMemo(
    () => (network.status === 'ready' && rack ? wentOffline(network.data.offline, rack.rows, OFFLINE_LIMIT) : null),
    [network, rack],
  )
  const platforms = useMemo(() => new Map(live.agents.map((agent) => [agent.name, agent.platform])), [live.agents])
  const scans = useMemo(
    () => (reports.status === 'ready' ? latestScans(reports.data, live.scans, platforms, SCANS_LIMIT) : null),
    [reports, live.scans, platforms],
  )
  const overlay = useMemo(
    () => ({ pending: Object.values(live.pending), failures: live.failures, outcomes: discovery.outcomes }),
    [live.pending, live.failures, discovery.outcomes],
  )
  const connected = live.agents.filter((agent) => agent.connected).length

  return (
    <div className="dashboard">
      {network.status === 'error' && <p className="alert">{network.message}</p>}
      {reports.status === 'error' && <p className="alert">{reports.message}</p>}
      {rack && devices ? (
        <>
          <NetworkSummary rack={rack} devices={devices} agents={connected} />
          <RackPanel rows={rack.rows} live={live} fiberClass={pulseClass(live.anySweep, live.settled, 'rx')} />
        </>
      ) : (
        network.status === 'loading' && <p className="text-fg-3">Loading network...</p>
      )}
      <div className="lower">
        <WentOfflinePanel entries={offline} failed={network.status === 'error'} />
        <DiscoveryPanel
          loaded={discovery.loaded}
          error={discovery.error}
          agents={discovery.agents}
          assignments={discovery.assignments}
          overlay={overlay}
        />
        <LatestScansPanel entries={scans} failed={reports.status === 'error'} />
      </div>
    </div>
  )
}
