import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import api, { getErrorMessage } from '@/lib/api'
import type { Vlan } from '@/types'
import { Modal } from '@/components/Modal'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { FormField, inputClass } from '@/components/FormField'
import { EmptyState } from '@/components/EmptyState'

interface VlanFormState {
  mode: 'create' | 'edit'
  vlan?: Vlan
}

export default function VlanListPage() {
  const [vlans, setVlans] = useState<Vlan[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [form, setForm] = useState<VlanFormState | null>(null)
  const [toDelete, setToDelete] = useState<Vlan | null>(null)
  const [deleting, setDeleting] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await api.get<Vlan[]>('/vlans')
      setVlans(data)
      setError('')
    } catch (e) {
      setError(getErrorMessage(e, 'Failed to load VLANs'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function handleSave(body: { vlanId: number; name: string; description?: string }) {
    if (form?.mode === 'edit' && form.vlan) {
      const { data } = await api.put<Vlan>(`/vlans/${form.vlan.vlanId}`, {
        name: body.name,
        description: body.description,
      })
      setVlans((list) => list.map((v) => (v.id === data.id ? data : v)))
    } else {
      const { data } = await api.post<Vlan>('/vlans', body)
      setVlans((list) => [...list, data])
    }
  }

  async function handleDelete() {
    if (!toDelete) return
    setDeleting(true)
    try {
      await api.delete(`/vlans/${toDelete.vlanId}`)
      setVlans((list) => list.filter((v) => v.id !== toDelete.id))
      setToDelete(null)
      setError('')
    } catch (e) {
      setError(getErrorMessage(e, 'Failed to delete VLAN'))
      setToDelete(null)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm text-slate-400">Virtual LANs and their subnets</p>
        <button
          onClick={() => setForm({ mode: 'create' })}
          className="btn btn-primary"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" className="h-4 w-4" aria-hidden="true">
            <path d="M12 5v14M5 12h14" />
          </svg>
          New VLAN
        </button>
      </div>

      {error && (
        <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">{error}</p>
      )}

      <div className="card overflow-hidden">
        <table className="w-full text-left">
          <thead className="border-b border-slate-800">
            <tr>
              <th className="th w-24">VLAN ID</th>
              <th className="th">Name</th>
              <th className="th">Description</th>
              <th className="th w-32">Created</th>
              <th className="th text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {loading ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                  Loading...
                </td>
              </tr>
            ) : vlans.length === 0 ? (
              <tr>
                <td colSpan={5}>
                  <EmptyState title="No VLANs" message="Create your first VLAN to get started" />
                </td>
              </tr>
            ) : (
              vlans.map((vlan) => (
                <tr key={vlan.id} className="transition-colors hover:bg-slate-800/40">
                  <td className="td font-mono text-indigo-400">{vlan.vlanId}</td>
                  <td className="td font-medium">
                    <Link to={`/vlans/${vlan.id}`} className="text-slate-200 transition-colors hover:text-indigo-400">
                      {vlan.name}
                    </Link>
                  </td>
                  <td className="td">{vlan.description || '—'}</td>
                  <td className="td tabular-nums">{new Date(vlan.createdAt).toLocaleDateString()}</td>
                  <td className="td whitespace-nowrap text-right">
                    <button
                      onClick={() => setForm({ mode: 'edit', vlan })}
                      className="mr-3 text-slate-400 transition-colors hover:text-slate-200"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => setToDelete(vlan)}
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
        <Modal title={form.mode === 'edit' ? 'Edit VLAN' : 'New VLAN'} onClose={() => setForm(null)}>
          <VlanForm
            initial={form.mode === 'edit' ? form.vlan : undefined}
            onSubmit={handleSave}
            onClose={() => setForm(null)}
          />
        </Modal>
      )}

      {toDelete && (
        <ConfirmDialog
          title="Delete VLAN"
          message={`Delete VLAN ${toDelete.vlanId} (${toDelete.name})? This cannot be undone.`}
          loading={deleting}
          onConfirm={handleDelete}
          onCancel={() => setToDelete(null)}
        />
      )}
    </div>
  )
}

function VlanForm({
  initial,
  onSubmit,
  onClose,
}: {
  initial?: Vlan
  onSubmit: (body: { vlanId: number; name: string; description?: string }) => Promise<void>
  onClose: () => void
}) {
  const [vlanId, setVlanId] = useState(initial ? String(initial.vlanId) : '')
  const [name, setName] = useState(initial?.name ?? '')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const id = Number(vlanId)
    if (!Number.isInteger(id) || id < 1 || id > 4094) {
      setError('VLAN ID must be an integer between 1 and 4094')
      return
    }
    setSaving(true)
    setError('')
    try {
      await onSubmit({ vlanId: id, name: name.trim(), description: description.trim() || undefined })
      onClose()
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to save VLAN'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-400">{error}</p>}
      <FormField label="VLAN ID" hint={initial ? 'VLAN ID cannot be changed' : 'Between 1 and 4094'}>
        <input
          type="number"
          min={1}
          max={4094}
          className={inputClass}
          value={vlanId}
          onChange={(e) => setVlanId(e.target.value)}
          disabled={!!initial}
          required
        />
      </FormField>
      <FormField label="Name">
        <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} required />
      </FormField>
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
