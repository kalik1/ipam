import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import axios from 'axios'
import api, { getErrorMessage } from '@/lib/api'
import type { VlanDetail } from '@/types'
import { UtilizationBar } from '@/components/UtilizationBar'
import { EmptyState } from '@/components/EmptyState'

export default function VlanDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [vlan, setVlan] = useState<VlanDetail | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    try {
      const { data } = await api.get<VlanDetail>(`/vlans/${id}`)
      setVlan(data)
      setNotFound(false)
      setError('')
    } catch (e) {
      if (axios.isAxiosError(e) && e.response?.status === 404) {
        setNotFound(true)
      } else {
        setError(getErrorMessage(e, 'Failed to load VLAN'))
      }
    }
  }, [id])

  useEffect(() => {
    void load()
  }, [load])

  if (error) {
    return <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">{error}</p>
  }
  if (notFound) {
    return <EmptyState title="VLAN not found" message="It may have been deleted" />
  }
  if (!vlan) {
    return <p className="text-sm text-slate-500">Loading...</p>
  }

  const cards = [
    { label: 'Subnets', value: String(vlan.subnets.length) },
    { label: 'Devices', value: String(vlan.deviceCount) },
    { label: 'Created', value: new Date(vlan.createdAt).toLocaleDateString() },
  ]

  return (
    <div className="space-y-6">
      <div>
        <nav className="flex items-center gap-2 text-sm text-slate-500">
          <Link to="/vlans" className="transition-colors hover:text-slate-300">
            VLANs
          </Link>
          <span aria-hidden="true">/</span>
          <span className="text-slate-300">{vlan.name}</span>
        </nav>
        <div className="mt-2 flex items-baseline gap-3">
          <h1 className="text-xl font-semibold tracking-tight">{vlan.name}</h1>
          <span className="rounded-md bg-indigo-500/10 px-2 py-0.5 font-mono text-xs text-indigo-400 ring-1 ring-inset ring-indigo-500/20">
            VLAN {vlan.vlanId}
          </span>
        </div>
        {vlan.description && <p className="mt-1 text-sm text-slate-400">{vlan.description}</p>}
      </div>

      <div className="grid grid-cols-3 gap-4">
        {cards.map((card) => (
          <div key={card.label} className="card p-5">
            <p className="text-[13px] font-medium text-slate-400">{card.label}</p>
            <p className="mt-2 text-3xl font-semibold tracking-tight tabular-nums text-slate-50">{card.value}</p>
          </div>
        ))}
      </div>

      <div className="card overflow-hidden">
        <h2 className="border-b border-slate-800 px-5 py-4 text-xs font-semibold uppercase tracking-wider text-slate-400">
          Subnets
        </h2>
        {vlan.subnets.length === 0 ? (
          <EmptyState title="No subnets" message="This VLAN has no subnets yet" />
        ) : (
          <table className="w-full text-left">
            <thead className="border-b border-slate-800">
              <tr>
                <th className="th">Name</th>
                <th className="th">CIDR</th>
                <th className="th">Gateways</th>
                <th className="th">Utilization</th>
                <th className="th">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {vlan.subnets.map((subnet) => (
                <tr key={subnet.id} className="transition-colors hover:bg-slate-800/40">
                  <td className="td font-medium">
                    <Link to={`/subnets/${subnet.id}`} className="text-slate-200 transition-colors hover:text-indigo-400">
                      {subnet.name}
                    </Link>
                  </td>
                  <td className="td font-mono text-indigo-400">{subnet.cidr}</td>
                  <td className="td font-mono text-amber-400">
                    {subnet.gateways.length > 0 ? subnet.gateways.join(', ') : '—'}
                  </td>
                  <td className="td">
                    <UtilizationBar used={subnet.usedHosts} total={subnet.totalHosts} />
                  </td>
                  <td className="td tabular-nums">{new Date(subnet.createdAt).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
