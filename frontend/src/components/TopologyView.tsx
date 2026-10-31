import { useState } from 'react'
import { Link } from 'react-router-dom'
import { timeAgo } from '@/lib/format'
import type { Topology, TopologySubnet, TopologyVlan } from '@/types'
import { UtilizationBar } from '@/components/UtilizationBar'
import { EmptyState } from '@/components/EmptyState'

export function TopologyView({
  topology,
  hideOffline = false,
}: {
  topology: Topology
  hideOffline?: boolean
}) {
  if (topology.vlans.length === 0) {
    return <EmptyState title="No VLANs" message="Create a VLAN to see the topology here" />
  }
  return (
    <div className="columns-1 gap-4 lg:columns-2">
      {topology.vlans.map((vlan) => (
        <VlanSection key={vlan.id ?? 'unassigned'} vlan={vlan} hideOffline={hideOffline} />
      ))}
    </div>
  )
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`h-4 w-4 shrink-0 text-slate-500 transition-transform duration-200 ${open ? 'rotate-90' : ''}`}
      aria-hidden="true"
    >
      <path d="m9 6 6 6-6 6" />
    </svg>
  )
}

function VlanSection({
  vlan,
  hideOffline,
}: {
  vlan: TopologyVlan
  hideOffline: boolean
}) {
  const [open, setOpen] = useState(true)
  return (
    <div className="card mb-4 break-inside-avoid overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-3 border-b border-slate-800 px-5 py-3.5 text-left transition-colors hover:bg-slate-800/30"
        aria-expanded={open}
      >
        <Chevron open={open} />
        {vlan.vlanId !== null && (
          <span className="rounded-md bg-indigo-500/10 px-2 py-0.5 font-mono text-xs text-indigo-400 ring-1 ring-inset ring-indigo-500/20">
            VLAN {vlan.vlanId}
          </span>
        )}
        <span className="text-sm font-semibold text-slate-100">{vlan.name}</span>
        {vlan.description && <span className="hidden truncate text-sm text-slate-500 sm:inline">{vlan.description}</span>}
        <span className="ml-auto shrink-0 text-xs text-slate-500">
          {vlan.subnets.length} subnet{vlan.subnets.length === 1 ? '' : 's'}
        </span>
      </button>
      {open &&
        (vlan.subnets.length === 0 ? (
          <p className="px-5 py-4 text-sm text-slate-500">No subnets</p>
        ) : (
          <div className="divide-y divide-slate-800/60 animate-fade-in">
            {vlan.subnets.map((subnet) => (
              <SubnetSection key={subnet.id} subnet={subnet} hideOffline={hideOffline} />
            ))}
          </div>
        ))}
    </div>
  )
}

function SubnetSection({
  subnet,
  hideOffline,
}: {
  subnet: TopologySubnet
  hideOffline: boolean
}) {
  const devices = hideOffline
    ? subnet.devices.filter((device) => device.status === 'online')
    : subnet.devices
  return (
    <div className="px-5 py-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="min-w-0">
          <Link
            to={`/subnets/${subnet.id}`}
            className="text-sm font-medium text-slate-200 transition-colors hover:text-indigo-400"
          >
            {subnet.name}
          </Link>
          <p className="font-mono text-xs text-slate-500">
            {subnet.cidr}
            {subnet.gateways.length > 0 && (
              <span className="ml-3">gw {subnet.gateways.join(', ')}</span>
            )}
          </p>
        </div>
        <UtilizationBar used={subnet.used} total={subnet.total} />
      </div>
      {devices.length > 0 && (
        <div className="mt-4 space-y-2 border-l border-slate-800 pl-4">
          {devices.map((device) => (
            <div key={device.id} className="flex items-center gap-3 text-sm">
              <span
                className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                  device.status === 'online' ? 'bg-emerald-400 shadow-[0_0_6px] shadow-emerald-400/50' : 'bg-slate-600'
                }`}
              />
              <span className="w-32 shrink-0 font-mono text-indigo-400">{device.ip}</span>
              <span className="truncate text-slate-300">{device.hostname || '—'}</span>
              <span className="ml-auto shrink-0 text-xs text-slate-500">{timeAgo(device.lastSeen)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
