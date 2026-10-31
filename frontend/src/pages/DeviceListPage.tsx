import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import api, { getErrorMessage } from '@/lib/api'
import { timeAgo } from '@/lib/format'
import type { Device, Subnet } from '@/types'
import { Modal } from '@/components/Modal'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { FormField, inputClass } from '@/components/FormField'
import { Badge } from '@/components/Badge'
import { EmptyState } from '@/components/EmptyState'

interface DeviceFormState {
  mode: 'create' | 'edit'
  device?: Device
}

interface DeviceBody {
  ip: string
  mac?: string
  hostname?: string
  vendor?: string
  subnetId?: number
  notes?: string
}

export default function DeviceListPage() {
  const [devices, setDevices] = useState<Device[]>([])
  const [subnets, setSubnets] = useState<Subnet[]>([])
  const [search, setSearch] = useState('')
  const [subnetId, setSubnetId] = useState('')
  const [status, setStatus] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [form, setForm] = useState<DeviceFormState | null>(null)
  const [toDelete, setToDelete] = useState<Device | null>(null)
  const [deleting, setDeleting] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params: Record<string, string | number> = {}
      if (search) params.search = search
      if (subnetId) params.subnetId = Number(subnetId)
      if (status) params.status = status
      const { data } = await api.get<Device[]>('/devices', { params })
      setDevices(data)
      setError('')
    } catch (e) {
      setError(getErrorMessage(e, 'Failed to load devices'))
    } finally {
      setLoading(false)
    }
  }, [search, subnetId, status])

  useEffect(() => {
    const timer = setTimeout(() => {
      void load()
    }, 300)
    return () => clearTimeout(timer)
  }, [load])

  useEffect(() => {
    api
      .get<Subnet[]>('/subnets')
      .then((res) => setSubnets(res.data))
      .catch(() => undefined)
  }, [])

  async function handleSave(body: DeviceBody) {
    if (form?.mode === 'edit' && form.device) {
      const { data } = await api.put<Device>(`/devices/${form.device.id}`, body)
      setDevices((list) => list.map((d) => (d.id === data.id ? data : d)))
    } else {
      const { data } = await api.post<Device>('/devices', body)
      setDevices((list) => [...list, data])
    }
  }

  async function handleDelete() {
    if (!toDelete) return
    setDeleting(true)
    try {
      await api.delete(`/devices/${toDelete.id}`)
      setDevices((list) => list.filter((d) => d.id !== toDelete.id))
      setToDelete(null)
      setError('')
    } catch (e) {
      setError(getErrorMessage(e, 'Failed to delete device'))
      setToDelete(null)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm text-slate-400">Discovered and registered devices</p>
        <button
          onClick={() => setForm({ mode: 'create' })}
          className="btn btn-primary"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" className="h-4 w-4" aria-hidden="true">
            <path d="M12 5v14M5 12h14" />
          </svg>
          New device
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" aria-hidden="true">
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
          </svg>
          <input
            className={`${inputClass} w-64 pl-9`}
            placeholder="Search IP, hostname, MAC..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select className={`${inputClass} w-48`} value={subnetId} onChange={(e) => setSubnetId(e.target.value)}>
          <option value="">All subnets</option>
          {subnets.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <select className={`${inputClass} w-40`} value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All statuses</option>
          <option value="online">Online</option>
          <option value="offline">Offline</option>
        </select>
      </div>

      {error && (
        <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">{error}</p>
      )}

      <div className="card overflow-hidden">
        <table className="w-full text-left">
          <thead className="border-b border-slate-800">
            <tr>
              <th className="th">IP</th>
              <th className="th">MAC</th>
              <th className="th">Hostname</th>
              <th className="th">Vendor</th>
              <th className="th">Subnet</th>
              <th className="th">Status</th>
              <th className="th">Last seen</th>
              <th className="th text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {loading ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-slate-500">
                  Loading...
                </td>
              </tr>
            ) : devices.length === 0 ? (
              <tr>
                <td colSpan={8}>
                  <EmptyState title="No devices" message="No devices match the current filters" />
                </td>
              </tr>
            ) : (
              devices.map((device) => (
                <tr key={device.id} className="transition-colors hover:bg-slate-800/40">
                  <td className="td font-mono text-indigo-400">{device.ip}</td>
                  <td className="td font-mono">{device.mac || '—'}</td>
                  <td className="td font-medium text-slate-200">{device.hostname || '—'}</td>
                  <td className="td">{device.vendor || '—'}</td>
                  <td className="td">
                    {device.subnet ? (
                      <Link to={`/subnets/${device.subnet.id}`} className="text-slate-300 transition-colors hover:text-indigo-400">
                        {device.subnet.name}
                      </Link>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="td">
                    <Badge status={device.status} />
                  </td>
                  <td className="td">{timeAgo(device.lastSeen)}</td>
                  <td className="td whitespace-nowrap text-right">
                    <button
                      onClick={() => setForm({ mode: 'edit', device })}
                      className="mr-3 text-slate-400 transition-colors hover:text-slate-200"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => setToDelete(device)}
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
        <Modal title={form.mode === 'edit' ? 'Edit device' : 'New device'} onClose={() => setForm(null)}>
          <DeviceForm
            initial={form.mode === 'edit' ? form.device : undefined}
            subnets={subnets}
            onSubmit={handleSave}
            onClose={() => setForm(null)}
          />
        </Modal>
      )}

      {toDelete && (
        <ConfirmDialog
          title="Delete device"
          message={`Delete device ${toDelete.ip}${toDelete.hostname ? ` (${toDelete.hostname})` : ''}? This cannot be undone.`}
          loading={deleting}
          onConfirm={handleDelete}
          onCancel={() => setToDelete(null)}
        />
      )}
    </div>
  )
}

function DeviceForm({
  initial,
  subnets,
  onSubmit,
  onClose,
}: {
  initial?: Device
  subnets: Subnet[]
  onSubmit: (body: DeviceBody) => Promise<void>
  onClose: () => void
}) {
  const [ip, setIp] = useState(initial?.ip ?? '')
  const [mac, setMac] = useState(initial?.mac ?? '')
  const [hostname, setHostname] = useState(initial?.hostname ?? '')
  const [vendor, setVendor] = useState(initial?.vendor ?? '')
  const [subnetId, setSubnetId] = useState(initial?.subnetId ? String(initial.subnetId) : '')
  const [notes, setNotes] = useState(initial?.notes ?? '')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      await onSubmit({
        ip: ip.trim(),
        mac: mac.trim() || undefined,
        hostname: hostname.trim() || undefined,
        vendor: vendor.trim() || undefined,
        subnetId: subnetId ? Number(subnetId) : undefined,
        notes: notes.trim() || undefined,
      })
      onClose()
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to save device'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-400">{error}</p>}
      <div className="grid grid-cols-2 gap-4">
        <FormField label="IP">
          <input className={inputClass} value={ip} onChange={(e) => setIp(e.target.value)} required />
        </FormField>
        <FormField label="MAC">
          <input className={inputClass} value={mac} onChange={(e) => setMac(e.target.value)} placeholder="AA:BB:CC:DD:EE:FF" />
        </FormField>
        <FormField label="Hostname">
          <input className={inputClass} value={hostname} onChange={(e) => setHostname(e.target.value)} />
        </FormField>
        <FormField label="Vendor">
          <input className={inputClass} value={vendor} onChange={(e) => setVendor(e.target.value)} />
        </FormField>
      </div>
      <FormField label="Subnet">
        <select className={inputClass} value={subnetId} onChange={(e) => setSubnetId(e.target.value)}>
          <option value="">None</option>
          {subnets.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name} ({s.cidr})
            </option>
          ))}
        </select>
      </FormField>
      <FormField label="Notes">
        <textarea className={inputClass} value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
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
