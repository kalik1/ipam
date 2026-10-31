import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import axios from 'axios'
import api, { deleteDhcpPool, getErrorMessage, createDhcpPool } from '@/lib/api'
import { timeAgo } from '@/lib/format'
import type { DhcpPool, SubnetDetail } from '@/types'
import { Badge } from '@/components/Badge'
import { UtilizationBar } from '@/components/UtilizationBar'
import { EmptyState } from '@/components/EmptyState'
import { IpGrid } from '@/components/IpGrid'
import { FormField, inputClass } from '@/components/FormField'

export default function SubnetDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [subnet, setSubnet] = useState<SubnetDetail | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    try {
      const { data } = await api.get<SubnetDetail>(`/subnets/${id}`)
      setSubnet(data)
      setNotFound(false)
      setError('')
    } catch (e) {
      if (axios.isAxiosError(e) && e.response?.status === 404) {
        setNotFound(true)
      } else {
        setError(getErrorMessage(e, 'Failed to load subnet'))
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
    return <EmptyState title="Subnet not found" message="It may have been deleted" />
  }
  if (!subnet) {
    return <p className="text-sm text-slate-500">Loading...</p>
  }

  return (
    <div className="space-y-6">
      <div>
        <nav className="flex items-center gap-2 text-sm text-slate-500">
          <Link to="/subnets" className="transition-colors hover:text-slate-300">
            Subnets
          </Link>
          <span aria-hidden="true">/</span>
          <span className="text-slate-300">{subnet.name}</span>
        </nav>
        <div className="mt-2 flex items-baseline gap-3">
          <h1 className="text-xl font-semibold tracking-tight">{subnet.name}</h1>
          <span className="rounded-md bg-indigo-500/10 px-2 py-0.5 font-mono text-xs text-indigo-400 ring-1 ring-inset ring-indigo-500/20">
            {subnet.cidr}
          </span>
          {subnet.includeFirstLast && (
            <span className="rounded-md bg-sky-500/10 px-2 py-0.5 text-xs text-sky-400 ring-1 ring-inset ring-sky-500/20">
              first/last usable
            </span>
          )}
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-x-6 gap-y-1 text-sm text-slate-400">
          {subnet.vlan && (
            <span>
              VLAN{' '}
              <Link to={`/vlans/${subnet.vlan.id}`} className="text-indigo-400 transition-colors hover:text-indigo-300">
                {subnet.vlan.vlanId} - {subnet.vlan.name}
              </Link>
            </span>
          )}
          <span className="flex items-center gap-1.5">
            {subnet.gateways.length === 0 ? (
              '—'
            ) : (
              subnet.gateways.map((gateway) => (
                <span
                  key={gateway}
                  className="rounded-md bg-amber-500/10 px-2 py-0.5 font-mono text-xs text-amber-400 ring-1 ring-inset ring-amber-500/20"
                >
                  {gateway}
                </span>
              ))
            )}
          </span>
          {subnet.domainName && (
            <span>
              Domain{' '}
              <span className="font-mono text-slate-300">{subnet.domainName}</span>
            </span>
          )}
          {subnet.dnsServers && (
            <span>
              DNS{' '}
              <span className="font-mono text-slate-300">{subnet.dnsServers}</span>
            </span>
          )}
          {subnet.ntpServers && (
            <span>
              NTP{' '}
              <span className="font-mono text-slate-300">{subnet.ntpServers}</span>
            </span>
          )}
          {subnet.description && <span>{subnet.description}</span>}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="card p-5">
          <p className="text-[13px] font-medium text-slate-400">Devices</p>
          <p className="mt-2 text-3xl font-semibold tracking-tight tabular-nums text-slate-50">{subnet.devices.length}</p>
        </div>
        <div className="card p-5">
          <p className="text-[13px] font-medium text-slate-400">Utilization</p>
          <div className="mt-3">
            <UtilizationBar used={subnet.usedHosts} total={subnet.totalHosts} />
          </div>
        </div>
        <div className="card p-5">
          <p className="text-[13px] font-medium text-slate-400">Created</p>
          <p className="mt-2 text-3xl font-semibold tracking-tight tabular-nums text-slate-50">
            {new Date(subnet.createdAt).toLocaleDateString()}
          </p>
        </div>
      </div>

      <div className="card p-5">
        <h2 className="mb-4 text-xs font-semibold uppercase tracking-wider text-slate-400">IP map</h2>
        <IpGrid
          cidr={subnet.cidr}
          includeFirstLast={subnet.includeFirstLast}
          gateways={subnet.gateways}
          dhcpPools={subnet.dhcpPools}
          devices={subnet.devices}
        />
      </div>

      <DhcpPoolsSection subnet={subnet} onRefresh={load} />

      <div className="card overflow-hidden">
        <h2 className="border-b border-slate-800 px-5 py-4 text-xs font-semibold uppercase tracking-wider text-slate-400">
          Devices
        </h2>
        {subnet.devices.length === 0 ? (
          <EmptyState title="No devices" message="This subnet has no devices yet" />
        ) : (
          <table className="w-full text-left">
            <thead className="border-b border-slate-800">
              <tr>
                <th className="th">IP</th>
                <th className="th">Hostname</th>
                <th className="th">MAC</th>
                <th className="th">Status</th>
                <th className="th">Last seen</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {subnet.devices.map((device) => (
                <tr key={device.id} className="transition-colors hover:bg-slate-800/40">
                  <td className="td font-mono text-indigo-400">{device.ip}</td>
                  <td className="td font-medium text-slate-200">{device.hostname || '—'}</td>
                  <td className="td font-mono">{device.mac || '—'}</td>
                  <td className="td">
                    <Badge status={device.status} />
                  </td>
                  <td className="td">{timeAgo(device.lastSeen)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

function DhcpPoolsSection({ subnet, onRefresh }: { subnet: SubnetDetail; onRefresh: () => void }) {
  const [name, setName] = useState('')
  const [startIp, setStartIp] = useState('')
  const [endIp, setEndIp] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const pools = subnet.dhcpPools

  async function handleAdd(e: FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      await createDhcpPool(subnet.id, {
        name: name.trim() || undefined,
        startIp: startIp.trim(),
        endIp: endIp.trim(),
      })
      setName('')
      setStartIp('')
      setEndIp('')
      await onRefresh()
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to add pool'))
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(pool: DhcpPool) {
    setError('')
    try {
      await deleteDhcpPool(pool.id)
      await onRefresh()
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to delete pool'))
    }
  }

  return (
    <div className="card overflow-hidden">
      <h2 className="border-b border-slate-800 px-5 py-4 text-xs font-semibold uppercase tracking-wider text-slate-400">
        DHCP pools
      </h2>
      {pools.length === 0 ? (
        <EmptyState title="No DHCP pools" message="This subnet has no DHCP pools yet" />
      ) : (
        <table className="w-full text-left">
          <thead className="border-b border-slate-800">
            <tr>
              <th className="th">Name</th>
              <th className="th">Range</th>
              <th className="th text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {pools.map((pool) => (
              <tr key={pool.id} className="transition-colors hover:bg-slate-800/40">
                <td className="td font-medium text-slate-200">{pool.name || '—'}</td>
                <td className="td font-mono text-sky-400">
                  {pool.startIp} - {pool.endIp}
                </td>
                <td className="td whitespace-nowrap text-right">
                  <button
                    onClick={() => void handleDelete(pool)}
                    className="text-red-400 transition-colors hover:text-red-300"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <div className="border-t border-slate-800 px-5 py-4">
        <form onSubmit={handleAdd} className="flex flex-wrap items-end gap-3">
          <div className="w-40">
            <FormField label="Name">
              <input
                className={inputClass}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Optional"
              />
            </FormField>
          </div>
          <div className="w-40">
            <FormField label="Start IP">
              <input
                className={inputClass}
                value={startIp}
                onChange={(e) => setStartIp(e.target.value)}
                placeholder="192.168.1.100"
                required
              />
            </FormField>
          </div>
          <div className="w-40">
            <FormField label="End IP">
              <input
                className={inputClass}
                value={endIp}
                onChange={(e) => setEndIp(e.target.value)}
                placeholder="192.168.1.200"
                required
              />
            </FormField>
          </div>
          <button type="submit" disabled={saving} className="btn btn-primary">
            {saving ? 'Adding...' : 'Add pool'}
          </button>
        </form>
        {error && (
          <p className="mt-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-400">
            {error}
          </p>
        )}
      </div>
    </div>
  )
}
