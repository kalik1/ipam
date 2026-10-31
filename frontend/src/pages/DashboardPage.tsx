import { useEffect, useState } from 'react'
import api, { getErrorMessage } from '@/lib/api'
import type { Summary, Topology } from '@/types'
import { TopologyView } from '@/components/TopologyView'

function StatIcon({ d, className }: { d: string; className: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={`h-5 w-5 ${className}`} aria-hidden="true">
      <path d={d} />
    </svg>
  )
}

const ICONS = {
  layers: 'M12 2 2 7l10 5 10-5-10-5z M2 17l10 5 10-5 M2 12l10 5 10-5',
  subnets: 'M2 12h4 M18 12h4 M12 2v4 M12 18v4 M5 5l2.5 2.5 M16.5 16.5 19 19 M19 5l-2.5 2.5 M7.5 16.5 5 19 M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z',
  devices: 'M2 4h20v12H2z M8 20h8 M12 16v4',
  signal: 'M2 20h.01 M7 20v-4 M12 20v-8 M17 20V8 M22 20V4',
}

export default function DashboardPage() {
  const [summary, setSummary] = useState<Summary | null>(null)
  const [topology, setTopology] = useState<Topology | null>(null)
  const [hideOffline, setHideOffline] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    Promise.all([api.get<Summary>('/summary'), api.get<Topology>('/topology')])
      .then(([summaryRes, topologyRes]) => {
        setSummary(summaryRes.data)
        setTopology(topologyRes.data)
      })
      .catch((e) => setError(getErrorMessage(e, 'Failed to load overview')))
  }, [])

  if (error) {
    return <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">{error}</p>
  }
  if (!summary || !topology) {
    return <p className="text-sm text-slate-500">Loading...</p>
  }

  const cards = [
    { label: 'VLANs', value: String(summary.vlans), icon: ICONS.layers, accent: 'text-indigo-400 bg-indigo-500/10 ring-indigo-500/20' },
    { label: 'Subnets', value: String(summary.subnets), icon: ICONS.subnets, accent: 'text-sky-400 bg-sky-500/10 ring-sky-500/20' },
    { label: 'Devices', value: String(summary.devices), icon: ICONS.devices, accent: 'text-violet-400 bg-violet-500/10 ring-violet-500/20' },
    { label: 'Online / Offline', value: `${summary.devicesOnline} / ${summary.devicesOffline}`, icon: ICONS.signal, accent: 'text-emerald-400 bg-emerald-500/10 ring-emerald-500/20' },
  ]

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {cards.map((card) => (
          <div key={card.label} className="card relative overflow-hidden p-5">
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-indigo-500/50 to-transparent" />
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[13px] font-medium text-slate-400">{card.label}</p>
                <p className="mt-2 text-3xl font-semibold tracking-tight tabular-nums text-slate-50">{card.value}</p>
              </div>
              <div className={`flex h-10 w-10 items-center justify-center rounded-xl ring-1 ring-inset ${card.accent}`}>
                <StatIcon d={card.icon} className="h-5 w-5" />
              </div>
            </div>
          </div>
        ))}
      </div>
      <div>
        <div className="mb-4 flex items-center justify-between gap-4">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Network topology
          </h2>
          <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-300">
            <input
              type="checkbox"
              checked={hideOffline}
              onChange={(e) => setHideOffline(e.target.checked)}
              className="h-4 w-4 rounded border-slate-700 bg-slate-950/60 accent-indigo-500"
            />
            Hide offline devices
          </label>
        </div>
        <TopologyView topology={topology} hideOffline={hideOffline} />
      </div>
    </div>
  )
}
