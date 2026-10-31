import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import api, { getErrorMessage } from '@/lib/api'
import type { Subnet, Vlan } from '@/types'
import { Modal } from '@/components/Modal'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { FormField, inputClass } from '@/components/FormField'
import { UtilizationBar } from '@/components/UtilizationBar'
import { EmptyState } from '@/components/EmptyState'

interface SubnetFormState {
  mode: 'create' | 'edit'
  subnet?: Subnet
}

interface PoolDraft {
  name: string
  startIp: string
  endIp: string
}

interface SubnetBody {
  name: string
  cidr: string
  gateways: string[]
  includeFirstLast: boolean
  dhcpPools: { name?: string; startIp: string; endIp: string }[]
  vlanId?: number
  description?: string
  domainName?: string
  dnsServers?: string
  ntpServers?: string
}

export default function SubnetListPage() {
  const [subnets, setSubnets] = useState<Subnet[]>([])
  const [vlans, setVlans] = useState<Vlan[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [form, setForm] = useState<SubnetFormState | null>(null)
  const [toDelete, setToDelete] = useState<Subnet | null>(null)
  const [deleting, setDeleting] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [subnetsRes, vlansRes] = await Promise.all([
        api.get<Subnet[]>('/subnets'),
        api.get<Vlan[]>('/vlans'),
      ])
      setSubnets(subnetsRes.data)
      setVlans(vlansRes.data)
      setError('')
    } catch (e) {
      setError(getErrorMessage(e, 'Failed to load subnets'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function handleSave(body: SubnetBody) {
    if (form?.mode === 'edit' && form.subnet) {
      const { data } = await api.put<Subnet>(`/subnets/${form.subnet.id}`, body)
      setSubnets((list) => list.map((s) => (s.id === data.id ? data : s)))
    } else {
      const { data } = await api.post<Subnet>('/subnets', body)
      setSubnets((list) => [...list, data])
    }
  }

  async function handleDelete() {
    if (!toDelete) return
    setDeleting(true)
    try {
      await api.delete(`/subnets/${toDelete.id}`)
      setSubnets((list) => list.filter((s) => s.id !== toDelete.id))
      setToDelete(null)
      setError('')
    } catch (e) {
      setError(getErrorMessage(e, 'Failed to delete subnet'))
      setToDelete(null)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm text-slate-400">IP ranges and CIDR blocks</p>
        <button
          onClick={() => setForm({ mode: 'create' })}
          className="btn btn-primary"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" className="h-4 w-4" aria-hidden="true">
            <path d="M12 5v14M5 12h14" />
          </svg>
          New subnet
        </button>
      </div>

      {error && (
        <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">{error}</p>
      )}

      <div className="card overflow-hidden">
        <table className="w-full text-left">
          <thead className="border-b border-slate-800">
            <tr>
              <th className="th">Name</th>
              <th className="th">CIDR</th>
              <th className="th">Gateways</th>
              <th className="th">DHCP</th>
              <th className="th">1st/last</th>
              <th className="th">VLAN</th>
              <th className="th">Utilization</th>
              <th className="th">Created</th>
              <th className="th text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {loading ? (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-slate-500">
                  Loading...
                </td>
              </tr>
            ) : subnets.length === 0 ? (
              <tr>
                <td colSpan={9}>
                  <EmptyState title="No subnets" message="Create your first subnet to get started" />
                </td>
              </tr>
            ) : (
              subnets.map((subnet) => (
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
                  <td className="td tabular-nums">{subnet.dhcpPools.length > 0 ? subnet.dhcpPools.length : '—'}</td>
                  <td className="td">
                    {subnet.includeFirstLast ? (
                      <span className="rounded-md bg-sky-500/10 px-1.5 py-0.5 text-xs text-sky-400 ring-1 ring-inset ring-sky-500/20">
                        yes
                      </span>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="td">{subnet.vlan?.name ?? '—'}</td>
                  <td className="td">
                    <UtilizationBar used={subnet.usedHosts} total={subnet.totalHosts} />
                  </td>
                  <td className="td tabular-nums">{new Date(subnet.createdAt).toLocaleDateString()}</td>
                  <td className="td whitespace-nowrap text-right">
                    <button
                      onClick={() => setForm({ mode: 'edit', subnet })}
                      className="mr-3 text-slate-400 transition-colors hover:text-slate-200"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => setToDelete(subnet)}
                      className="text-red-400 transition-colors hover:text-red-300"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {form && (
        <Modal title={form.mode === 'edit' ? 'Edit subnet' : 'New subnet'} onClose={() => setForm(null)}>
          <SubnetForm
            initial={form.mode === 'edit' ? form.subnet : undefined}
            vlans={vlans}
            onSubmit={handleSave}
            onClose={() => setForm(null)}
          />
        </Modal>
      )}

      {toDelete && (
        <ConfirmDialog
          title="Delete subnet"
          message={`Delete subnet ${toDelete.name} (${toDelete.cidr})? This cannot be undone.`}
          loading={deleting}
          onConfirm={handleDelete}
          onCancel={() => setToDelete(null)}
        />
      )}
    </div>
  )
}

function SubnetForm({
  initial,
  vlans,
  onSubmit,
  onClose,
}: {
  initial?: Subnet
  vlans: Vlan[]
  onSubmit: (body: SubnetBody) => Promise<void>
  onClose: () => void
}) {
  const [name, setName] = useState(initial?.name ?? '')
  const [cidr, setCidr] = useState(initial?.cidr ?? '')
  const [gateways, setGateways] = useState<string[]>(initial?.gateways ?? [])
  const [includeFirstLast, setIncludeFirstLast] = useState(initial?.includeFirstLast ?? false)
  const [pools, setPools] = useState<PoolDraft[]>(
    initial?.dhcpPools.map((pool) => ({ name: pool.name, startIp: pool.startIp, endIp: pool.endIp })) ?? [],
  )
  const [vlanId, setVlanId] = useState(initial?.vlanId ? String(initial.vlanId) : '')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [domainName, setDomainName] = useState(initial?.domainName ?? '')
  const [dnsServers, setDnsServers] = useState(initial?.dnsServers ?? '')
  const [ntpServers, setNtpServers] = useState(initial?.ntpServers ?? '')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  function updatePool(index: number, patch: Partial<PoolDraft>) {
    setPools((list) => list.map((pool, i) => (i === index ? { ...pool, ...patch } : pool)))
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      await onSubmit({
        name: name.trim(),
        cidr: cidr.trim(),
        gateways: gateways.map((gateway) => gateway.trim()).filter(Boolean),
        includeFirstLast,
        dhcpPools: pools
          .filter((pool) => pool.startIp.trim() !== '' && pool.endIp.trim() !== '')
          .map((pool) => ({
            name: pool.name.trim() || undefined,
            startIp: pool.startIp.trim(),
            endIp: pool.endIp.trim(),
          })),
        vlanId: vlanId ? Number(vlanId) : undefined,
        description: description.trim() || undefined,
        domainName: domainName.trim() || undefined,
        dnsServers: dnsServers.trim() || undefined,
        ntpServers: ntpServers.trim() || undefined,
      })
      onClose()
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to save subnet'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-400">{error}</p>}
      <FormField label="Name">
        <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} required />
      </FormField>
      <FormField label="CIDR" hint='Example: 192.168.1.0/24'>
        <input className={inputClass} value={cidr} onChange={(e) => setCidr(e.target.value)} required />
      </FormField>
      <div>
        <div className="mb-1.5 flex items-center justify-between">
          <span className="text-[13px] font-medium text-slate-300">Gateways</span>
          <button
            type="button"
            onClick={() => setGateways((list) => [...list, ''])}
            className="text-xs text-indigo-400 transition-colors hover:text-indigo-300"
          >
            + Add gateway
          </button>
        </div>
        {gateways.length === 0 ? (
          <p className="text-xs text-slate-500">No gateways</p>
        ) : (
          <div className="space-y-2">
            {gateways.map((gateway, index) => (
              <div key={index} className="flex items-center gap-2">
                <input
                  className={inputClass}
                  value={gateway}
                  onChange={(e) =>
                    setGateways((list) => list.map((value, i) => (i === index ? e.target.value : value)))
                  }
                  placeholder="Optional IP within the subnet"
                />
                <button
                  type="button"
                  onClick={() => setGateways((list) => list.filter((_, i) => i !== index))}
                  className="shrink-0 text-slate-500 transition-colors hover:text-red-400"
                  aria-label="Remove gateway"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" className="h-4 w-4" aria-hidden="true">
                    <path d="M18 6 6 18M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
      <label className="flex items-center gap-2 text-sm text-slate-300">
        <input
          type="checkbox"
          checked={includeFirstLast}
          onChange={(e) => setIncludeFirstLast(e.target.checked)}
          className="h-4 w-4 rounded border-slate-700 bg-slate-950/60 accent-indigo-500"
        />
        Include first/last addresses (point-to-point links)
      </label>
      <div>
        <div className="mb-1.5 flex items-center justify-between">
          <span className="text-[13px] font-medium text-slate-300">DHCP pools</span>
          <button
            type="button"
            onClick={() => setPools((list) => [...list, { name: '', startIp: '', endIp: '' }])}
            className="text-xs text-indigo-400 transition-colors hover:text-indigo-300"
          >
            + Add pool
          </button>
        </div>
        {pools.length === 0 ? (
          <p className="text-xs text-slate-500">No DHCP pools</p>
        ) : (
          <div className="space-y-2">
            {pools.map((pool, index) => (
              <div key={index} className="grid grid-cols-[1fr_1fr_1fr_auto] items-center gap-2">
                <input
                  className={inputClass}
                  value={pool.name}
                  onChange={(e) => updatePool(index, { name: e.target.value })}
                  placeholder="Name (optional)"
                />
                <input
                  className={inputClass}
                  value={pool.startIp}
                  onChange={(e) => updatePool(index, { startIp: e.target.value })}
                  placeholder="Start IP"
                />
                <input
                  className={inputClass}
                  value={pool.endIp}
                  onChange={(e) => updatePool(index, { endIp: e.target.value })}
                  placeholder="End IP"
                />
                <button
                  type="button"
                  onClick={() => setPools((list) => list.filter((_, i) => i !== index))}
                  className="shrink-0 text-slate-500 transition-colors hover:text-red-400"
                  aria-label="Remove pool"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" className="h-4 w-4" aria-hidden="true">
                    <path d="M18 6 6 18M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
      <FormField label="VLAN">
        <select className={inputClass} value={vlanId} onChange={(e) => setVlanId(e.target.value)}>
          <option value="">None</option>
          {vlans.map((vlan) => (
            <option key={vlan.id} value={vlan.vlanId}>
              {vlan.vlanId} - {vlan.name}
            </option>
          ))}
        </select>
      </FormField>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <FormField label="Domain name" hint='Example: lan.example.com'>
          <input className={inputClass} value={domainName} onChange={(e) => setDomainName(e.target.value)} placeholder="lan.example.com" />
        </FormField>
        <FormField label="DNS servers" hint='Comma-separated'>
          <input className={inputClass} value={dnsServers} onChange={(e) => setDnsServers(e.target.value)} placeholder="1.1.1.1, 8.8.8.8" />
        </FormField>
        <FormField label="NTP servers" hint='Comma-separated'>
          <input className={inputClass} value={ntpServers} onChange={(e) => setNtpServers(e.target.value)} placeholder="0.pool.ntp.org" />
        </FormField>
      </div>
      <FormField label="Description">
        <input className={inputClass} value={description} onChange={(e) => setDescription(e.target.value)} />
      </FormField>
      <div className="flex justify-end gap-3 pt-2">
        <button type="button" onClick={onClose} className="btn btn-secondary">
          Cancel
        </button>
        <button type="submit" disabled={saving} className="btn btn-primary">
          {saving ? 'Saving...' : 'Save'}
        </button>
      </div>
    </form>
  )
}
