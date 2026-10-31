import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import api, { getErrorMessage } from '@/lib/api'
import type { Vlan } from '@/types'
import { Button } from '@/components/Button'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { EmptyState } from '@/components/EmptyState'
import { FormField, inputClass } from '@/components/FormField'
import { Modal } from '@/components/Modal'
import { Panel, PanelHeader } from '@/components/Panel'
import { Table, TableMessage } from '@/components/Table'
import { Cable } from '@/components/VlanChip'
import { PageActions } from '@/components/shell/PageActions'

interface VlanFormState {
  mode: 'create' | 'edit'
  vlan?: Vlan
}

interface VlanBody {
  vlanId: number
  name: string
  description: string
}

const COLUMNS = 5

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

  async function handleSave(body: VlanBody) {
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
    <>
      <PageActions>
        <Button variant="primary" onClick={() => setForm({ mode: 'create' })}>
          Add VLAN
        </Button>
      </PageActions>

      {error && (
        <p className="alert" role="alert">
          {error}
        </p>
      )}

      <Panel aria-label="VLANs">
        <PanelHeader title="VLANs">
          <span className="list-count">{loading ? 'Loading' : `${vlans.length} ${vlans.length === 1 ? 'VLAN' : 'VLANs'}`}</span>
        </PanelHeader>
        <Table>
          <thead>
            <tr>
              <th>VLAN ID</th>
              <th>Name</th>
              <th>Description</th>
              <th>Created</th>
              <th className="num">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <TableMessage colSpan={COLUMNS}>Loading VLANs...</TableMessage>
            ) : vlans.length === 0 ? (
              <TableMessage colSpan={COLUMNS}>
                <EmptyState title="No VLANs" message="Add a VLAN to group subnets by 802.1Q tag" />
              </TableMessage>
            ) : (
              vlans.map((vlan) => (
                <tr key={vlan.id}>
                  <td>
                    <span className="cell-cable">
                      <Cable tag={vlan.vlanId} />
                      <span className="mono">{vlan.vlanId}</span>
                    </span>
                  </td>
                  <td>
                    <Link to={`/vlans/${vlan.id}`} className="cell-link">
                      {vlan.name}
                    </Link>
                  </td>
                  <td className="cell-trunc text-fg-2" title={vlan.description || undefined}>
                    {vlan.description || <span className="cell-muted">None</span>}
                  </td>
                  <td className="mono text-fg-2">{new Date(vlan.createdAt).toLocaleDateString()}</td>
                  <td>
                    <div className="row-actions">
                      <Button
                        variant="ghost"
                        aria-label={`Edit VLAN ${vlan.vlanId}`}
                        onClick={() => setForm({ mode: 'edit', vlan })}
                      >
                        Edit
                      </Button>
                      <Button variant="danger" aria-label={`Delete VLAN ${vlan.vlanId}`} onClick={() => setToDelete(vlan)}>
                        Delete
                      </Button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </Table>
      </Panel>

      {form && (
        <Modal title={form.mode === 'edit' ? 'Edit VLAN' : 'Add VLAN'} onClose={() => setForm(null)}>
          <VlanForm initial={form.mode === 'edit' ? form.vlan : undefined} onSubmit={handleSave} onClose={() => setForm(null)} />
        </Modal>
      )}

      {toDelete && (
        <ConfirmDialog
          title="Delete VLAN"
          message={`Delete VLAN ${toDelete.vlanId} (${toDelete.name})? This cannot be undone.`}
          confirmLabel="Delete VLAN"
          loading={deleting}
          onConfirm={handleDelete}
          onCancel={() => setToDelete(null)}
        />
      )}
    </>
  )
}

function VlanForm({
  initial,
  onSubmit,
  onClose,
}: {
  initial?: Vlan
  onSubmit: (body: VlanBody) => Promise<void>
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
      await onSubmit({ vlanId: id, name: name.trim(), description: description.trim() })
      onClose()
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to save VLAN'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="form-grid">
      {error && (
        <p className="alert" role="alert">
          {error}
        </p>
      )}
      <FormField label="VLAN ID" hint={initial ? 'The VLAN ID cannot be changed' : 'Between 1 and 4094'}>
        <input
          type="number"
          min={1}
          max={4094}
          className={`${inputClass} mono`}
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
      <div className="form-actions">
        <Button onClick={onClose}>Cancel</Button>
        <Button type="submit" variant="primary" disabled={saving} aria-busy={saving}>
          {saving ? 'Saving...' : initial ? 'Save changes' : 'Add VLAN'}
        </Button>
      </div>
    </form>
  )
}
