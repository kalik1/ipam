import { useCallback, useEffect, useId, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import api, { getErrorMessage } from '@/lib/api'
import { subnetOccupancy } from '@/lib/occupancy'
import { subnetBody, subnetDraft, vlanOptions, type PoolDraft, type SubnetBody, type SubnetDraft } from '@/lib/subnetForm'
import { vlanColor } from '@/lib/vlan'
import type { Subnet, Vlan } from '@/types'
import { Button } from '@/components/Button'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { EmptyState } from '@/components/EmptyState'
import { FormField, inputClass } from '@/components/FormField'
import { CloseIcon } from '@/components/icons'
import { Modal } from '@/components/Modal'
import { OccupancyMeter } from '@/components/OccupancyMeter'
import { Panel, PanelHeader } from '@/components/Panel'
import { Table, TableMessage } from '@/components/Table'
import { VlanChip } from '@/components/VlanChip'
import { PageActions } from '@/components/shell/PageActions'

interface SubnetFormState {
  mode: 'create' | 'edit'
  subnet?: Subnet
}

const COLUMNS = 10

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
      const [subnetsRes, vlansRes] = await Promise.all([api.get<Subnet[]>('/subnets'), api.get<Vlan[]>('/vlans')])
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
    <>
      <PageActions>
        <Button variant="primary" onClick={() => setForm({ mode: 'create' })}>
          Add subnet
        </Button>
      </PageActions>

      {error && (
        <p className="alert" role="alert">
          {error}
        </p>
      )}

      <Panel aria-label="Subnets">
        <PanelHeader title="Subnets">
          <span className="list-count">
            {loading ? 'Loading' : `${subnets.length} ${subnets.length === 1 ? 'subnet' : 'subnets'}`}
          </span>
        </PanelHeader>
        <Table>
          <thead>
            <tr>
              <th>Name</th>
              <th>CIDR</th>
              <th>VLAN</th>
              <th>Gateways</th>
              <th className="num">DHCP pools</th>
              <th>Network and broadcast</th>
              <th className="num">Occupied</th>
              <th className="num">Usable</th>
              <th>Created</th>
              <th className="num">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <TableMessage colSpan={COLUMNS}>Loading subnets...</TableMessage>
            ) : subnets.length === 0 ? (
              <TableMessage colSpan={COLUMNS}>
                <EmptyState title="No subnets" message="Add a subnet to start mapping addresses" />
              </TableMessage>
            ) : (
              subnets.map((subnet) => {
                const occupancy = subnetOccupancy(subnet)
                return (
                  <tr key={subnet.id}>
                    <td>
                      <Link to={`/subnets/${subnet.id}`} className="cell-link">
                        {subnet.name}
                      </Link>
                    </td>
                    <td className="mono">{subnet.cidr}</td>
                    <td>
                      <VlanChip vlan={subnet.vlan} />
                    </td>
                    <td className="mono text-fg-2">
                      {subnet.gateways.length > 0 ? subnet.gateways.join(', ') : <span className="cell-muted">None</span>}
                    </td>
                    <td className="num mono">{subnet.dhcpPools.length}</td>
                    <td className="text-fg-2">{subnet.includeFirstLast ? 'Usable' : <span className="cell-muted">Not usable</span>}</td>
                    <td className="num">
                      <OccupancyMeter occupancy={occupancy} color={vlanColor(subnet.vlan?.vlanId)} />
                    </td>
                    <td className="num mono">{occupancy.usable}</td>
                    <td className="mono text-fg-2">{new Date(subnet.createdAt).toLocaleDateString()}</td>
                    <td>
                      <div className="row-actions">
                        <Button
                          variant="ghost"
                          aria-label={`Edit subnet ${subnet.name}`}
                          onClick={() => setForm({ mode: 'edit', subnet })}
                        >
                          Edit
                        </Button>
                        <Button variant="danger" aria-label={`Delete subnet ${subnet.name}`} onClick={() => setToDelete(subnet)}>
                          Delete
                        </Button>
                      </div>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </Table>
      </Panel>

      {form && (
        <Modal title={form.mode === 'edit' ? 'Edit subnet' : 'Add subnet'} onClose={() => setForm(null)}>
          <SubnetForm
            mode={form.mode}
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
          confirmLabel="Delete subnet"
          loading={deleting}
          onConfirm={handleDelete}
          onCancel={() => setToDelete(null)}
        />
      )}
    </>
  )
}

function SubnetForm({
  mode,
  initial,
  vlans,
  onSubmit,
  onClose,
}: {
  mode: 'create' | 'edit'
  initial?: Subnet
  vlans: Vlan[]
  onSubmit: (body: SubnetBody) => Promise<void>
  onClose: () => void
}) {
  const ids = useId()
  const [draft, setDraft] = useState<SubnetDraft>(() => subnetDraft(initial))
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  function update(patch: Partial<SubnetDraft>) {
    setDraft((current) => ({ ...current, ...patch }))
  }

  function updateGateway(index: number, value: string) {
    setDraft((current) => ({ ...current, gateways: current.gateways.map((g, i) => (i === index ? value : g)) }))
  }

  function updatePool(index: number, patch: Partial<PoolDraft>) {
    setDraft((current) => ({
      ...current,
      pools: current.pools.map((pool, i) => (i === index ? { ...pool, ...patch } : pool)),
    }))
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      await onSubmit(subnetBody(draft, mode))
      onClose()
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to save subnet'))
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
      <div className="cols-2">
        <FormField label="Name">
          <input className={inputClass} value={draft.name} onChange={(e) => update({ name: e.target.value })} required />
        </FormField>
        <FormField label="CIDR" hint="Example: 192.168.1.0/24">
          <input
            className={`${inputClass} mono`}
            value={draft.cidr}
            onChange={(e) => update({ cidr: e.target.value })}
            required
          />
        </FormField>
      </div>
      <FormField label="VLAN">
        <select className={inputClass} value={draft.vlanId} onChange={(e) => update({ vlanId: e.target.value })}>
          <option value="">No VLAN</option>
          {vlanOptions(vlans).map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </FormField>

      <div className="form-list" role="group" aria-labelledby={`${ids}-gateways`}>
        <div className="form-list-head">
          <span id={`${ids}-gateways`} className="field-label">
            Gateways
          </span>
          <Button variant="ghost" onClick={() => update({ gateways: [...draft.gateways, ''] })}>
            Add gateway
          </Button>
        </div>
        {draft.gateways.length === 0 ? (
          <p className="form-list-empty">No gateways</p>
        ) : (
          draft.gateways.map((gateway, index) => (
            <div key={index} className="form-list-row">
              <input
                className={`${inputClass} mono`}
                value={gateway}
                onChange={(e) => updateGateway(index, e.target.value)}
                placeholder="IP inside the subnet"
                aria-label={`Gateway ${index + 1}`}
              />
              <Button
                variant="ghost"
                icon
                aria-label={`Remove gateway ${index + 1}`}
                onClick={() => update({ gateways: draft.gateways.filter((_, i) => i !== index) })}
              >
                <CloseIcon />
              </Button>
            </div>
          ))
        )}
      </div>

      <label className="form-check">
        <input
          type="checkbox"
          checked={draft.includeFirstLast}
          onChange={(e) => update({ includeFirstLast: e.target.checked })}
        />
        Count network and broadcast as usable addresses (point-to-point links)
      </label>

      <div className="form-list" role="group" aria-labelledby={`${ids}-pools`}>
        <div className="form-list-head">
          <span id={`${ids}-pools`} className="field-label">
            DHCP pools
          </span>
          <Button variant="ghost" onClick={() => update({ pools: [...draft.pools, { name: '', startIp: '', endIp: '' }] })}>
            Add pool
          </Button>
        </div>
        {draft.pools.length === 0 ? (
          <p className="form-list-empty">No DHCP pools</p>
        ) : (
          draft.pools.map((pool, index) => (
            <div key={index} className="form-list-row pool">
              <input
                className={inputClass}
                value={pool.name}
                onChange={(e) => updatePool(index, { name: e.target.value })}
                placeholder="Name (optional)"
                aria-label={`Pool ${index + 1} name`}
              />
              <input
                className={`${inputClass} mono`}
                value={pool.startIp}
                onChange={(e) => updatePool(index, { startIp: e.target.value })}
                placeholder="First IP"
                aria-label={`Pool ${index + 1} first IP`}
              />
              <input
                className={`${inputClass} mono`}
                value={pool.endIp}
                onChange={(e) => updatePool(index, { endIp: e.target.value })}
                placeholder="Last IP"
                aria-label={`Pool ${index + 1} last IP`}
              />
              <Button
                variant="ghost"
                icon
                aria-label={`Remove pool ${index + 1}`}
                onClick={() => update({ pools: draft.pools.filter((_, i) => i !== index) })}
              >
                <CloseIcon />
              </Button>
            </div>
          ))
        )}
      </div>

      <div className="cols-3">
        <FormField label="Domain name" hint="Example: lan.example.com">
          <input
            className={inputClass}
            value={draft.domainName}
            onChange={(e) => update({ domainName: e.target.value })}
            placeholder="lan.example.com"
          />
        </FormField>
        <FormField label="DNS servers" hint="Comma-separated">
          <input
            className={`${inputClass} mono`}
            value={draft.dnsServers}
            onChange={(e) => update({ dnsServers: e.target.value })}
            placeholder="1.1.1.1, 8.8.8.8"
          />
        </FormField>
        <FormField label="NTP servers" hint="Comma-separated">
          <input
            className={inputClass}
            value={draft.ntpServers}
            onChange={(e) => update({ ntpServers: e.target.value })}
            placeholder="0.pool.ntp.org"
          />
        </FormField>
      </div>
      <FormField label="Description">
        <input className={inputClass} value={draft.description} onChange={(e) => update({ description: e.target.value })} />
      </FormField>
      <div className="form-actions">
        <Button onClick={onClose}>Cancel</Button>
        <Button type="submit" variant="primary" disabled={saving} aria-busy={saving}>
          {saving ? 'Saving...' : mode === 'edit' ? 'Save changes' : 'Add subnet'}
        </Button>
      </div>
    </form>
  )
}
