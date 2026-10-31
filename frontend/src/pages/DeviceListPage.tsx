import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import api, { getErrorMessage } from '@/lib/api'
import { deviceBody, deviceDraft, subnetOptions, type DeviceBody, type DeviceDraft } from '@/lib/deviceForm'
import { filterByStatus, statusCounts, type StatusFilter } from '@/lib/deviceList'
import { formatTimestamp, timeAgo } from '@/lib/format'
import type { FormMode } from '@/lib/subnetForm'
import type { Device, Subnet } from '@/types'
import { Badge } from '@/components/Badge'
import { Button } from '@/components/Button'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { EmptyState } from '@/components/EmptyState'
import { FormField, inputClass } from '@/components/FormField'
import { Modal } from '@/components/Modal'
import { Panel, PanelHeader } from '@/components/Panel'
import { Selector } from '@/components/Selector'
import { Table, TableMessage } from '@/components/Table'
import { Tooltip } from '@/components/Tooltip'
import { Cable } from '@/components/VlanChip'
import { PageActions } from '@/components/shell/PageActions'

interface DeviceFormState {
  mode: FormMode
  device?: Device
}

const COLUMNS = 8

function deviceLabel(device: Device): string {
  return device.hostname ? `${device.ip} (${device.hostname})` : device.ip
}

export default function DeviceListPage() {
  const [devices, setDevices] = useState<Device[]>([])
  const [subnets, setSubnets] = useState<Subnet[]>([])
  const [search, setSearch] = useState('')
  const [subnetId, setSubnetId] = useState('')
  const [status, setStatus] = useState<StatusFilter>('all')
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
      const { data } = await api.get<Device[]>('/devices', { params })
      setDevices(data)
      setError('')
    } catch (e) {
      setError(getErrorMessage(e, 'Failed to load devices'))
    } finally {
      setLoading(false)
    }
  }, [search, subnetId])

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

  const subnetsById = useMemo(() => new Map(subnets.map((subnet) => [subnet.id, subnet])), [subnets])
  const counts = statusCounts(devices)
  const visible = filterByStatus(devices, status)

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
    <>
      <PageActions>
        <Button variant="primary" onClick={() => setForm({ mode: 'create' })}>
          Add device
        </Button>
      </PageActions>

      {error && (
        <p className="alert" role="alert">
          {error}
        </p>
      )}

      <Panel aria-label="Devices">
        <PanelHeader title="Devices">
          <div className="list-tools">
            <Selector
              label="Filter by status"
              value={status}
              onChange={setStatus}
              options={[
                { value: 'all', label: 'All', count: counts.all },
                { value: 'online', label: 'Online', count: counts.online },
                { value: 'offline', label: 'Offline', count: counts.offline },
              ]}
            />
            <input
              type="search"
              className={`${inputClass} search-input`}
              placeholder="Search IP, hostname or MAC"
              aria-label="Search devices"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <select
              className={`${inputClass} subnet-filter`}
              aria-label="Filter by subnet"
              value={subnetId}
              onChange={(e) => setSubnetId(e.target.value)}
            >
              <option value="">All subnets</option>
              {subnetOptions(subnets).map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <span className="list-count">{loading ? 'Loading' : `${visible.length} shown`}</span>
          </div>
        </PanelHeader>
        <Table>
          <thead>
            <tr>
              <th>Status</th>
              <th>IP address</th>
              <th>Hostname</th>
              <th>MAC address</th>
              <th>Vendor</th>
              <th>Subnet</th>
              <th>Last seen</th>
              <th className="num">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && devices.length === 0 ? (
              <TableMessage colSpan={COLUMNS}>Loading devices...</TableMessage>
            ) : visible.length === 0 ? (
              <TableMessage colSpan={COLUMNS}>
                <EmptyState title="No devices" message="No devices match the current filters" />
              </TableMessage>
            ) : (
              visible.map((device) => (
                <DeviceRow
                  key={device.id}
                  device={device}
                  subnet={device.subnetId === null ? undefined : subnetsById.get(device.subnetId)}
                  onEdit={() => setForm({ mode: 'edit', device })}
                  onDelete={() => setToDelete(device)}
                />
              ))
            )}
          </tbody>
        </Table>
      </Panel>

      {form && (
        <Modal title={form.mode === 'edit' ? 'Edit device' : 'Add device'} onClose={() => setForm(null)}>
          <DeviceForm
            mode={form.mode}
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
          message={`Delete device ${deviceLabel(toDelete)}? This cannot be undone.`}
          confirmLabel="Delete device"
          loading={deleting}
          onConfirm={handleDelete}
          onCancel={() => setToDelete(null)}
        />
      )}
    </>
  )
}

function DeviceRow({
  device,
  subnet,
  onEdit,
  onDelete,
}: {
  device: Device
  subnet: Subnet | undefined
  onEdit: () => void
  onDelete: () => void
}) {
  const subnetName = subnet?.name ?? device.subnet?.name
  return (
    <tr>
      <td>
        <Badge status={device.status} />
      </td>
      <td>
        {device.subnetId === null ? (
          <span className="mono">{device.ip}</span>
        ) : (
          <Tooltip tip="Show on the address map">
            <Link to={`/subnets/${device.subnetId}?ip=${encodeURIComponent(device.ip)}`} className="cell-link mono">
              {device.ip}
            </Link>
          </Tooltip>
        )}
      </td>
      <td className="font-semibold">{device.hostname || <span className="cell-muted font-normal">None</span>}</td>
      <td className="mono text-fg-2">{device.mac || <span className="cell-muted">None</span>}</td>
      <Tooltip tip={device.vendor} focusable>
        <td className="cell-trunc text-fg-2">{device.vendor || <span className="cell-muted">None</span>}</td>
      </Tooltip>
      <td>
        {device.subnetId === null ? (
          <span className="cell-cable cell-muted">
            <Cable tag={null} />
            No subnet
          </span>
        ) : (
          <Link to={`/subnets/${device.subnetId}`} className="cell-cable cell-link">
            <Cable tag={subnet?.vlan?.vlanId} />
            {subnetName ?? `Subnet ${device.subnetId}`}
          </Link>
        )}
      </td>
      <Tooltip tip={formatTimestamp(device.lastSeen)} focusable>
        <td className="text-fg-2">{timeAgo(device.lastSeen)}</td>
      </Tooltip>
      <td>
        <div className="row-actions">
          <Button variant="ghost" aria-label={`Edit device ${device.ip}`} onClick={onEdit}>
            Edit
          </Button>
          <Button variant="danger" aria-label={`Delete device ${device.ip}`} onClick={onDelete}>
            Delete
          </Button>
        </div>
      </td>
    </tr>
  )
}

function DeviceForm({
  mode,
  initial,
  subnets,
  onSubmit,
  onClose,
}: {
  mode: FormMode
  initial?: Device
  subnets: Subnet[]
  onSubmit: (body: DeviceBody) => Promise<void>
  onClose: () => void
}) {
  const [draft, setDraft] = useState<DeviceDraft>(() => deviceDraft(initial))
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  function update(patch: Partial<DeviceDraft>) {
    setDraft((current) => ({ ...current, ...patch }))
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      await onSubmit(deviceBody(draft, mode))
      onClose()
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to save device'))
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
        <FormField label="IP address">
          <input className={`${inputClass} mono`} value={draft.ip} onChange={(e) => update({ ip: e.target.value })} required />
        </FormField>
        <FormField label="MAC address">
          <input
            className={`${inputClass} mono`}
            value={draft.mac}
            onChange={(e) => update({ mac: e.target.value })}
            placeholder="AA:BB:CC:DD:EE:FF"
          />
        </FormField>
        <FormField label="Hostname">
          <input className={inputClass} value={draft.hostname} onChange={(e) => update({ hostname: e.target.value })} />
        </FormField>
        <FormField label="Vendor">
          <input className={inputClass} value={draft.vendor} onChange={(e) => update({ vendor: e.target.value })} />
        </FormField>
      </div>
      <FormField label="Subnet" hint={mode === 'create' ? 'Leave on automatic to use the subnet that contains the IP' : undefined}>
        <select className={inputClass} value={draft.subnetId} onChange={(e) => update({ subnetId: e.target.value })}>
          <option value="">{mode === 'create' ? 'Automatic, from the IP address' : 'No subnet'}</option>
          {subnetOptions(subnets).map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </FormField>
      <FormField label="Notes">
        <textarea className={inputClass} value={draft.notes} onChange={(e) => update({ notes: e.target.value })} rows={3} />
      </FormField>
      <div className="form-actions">
        <Button onClick={onClose}>Cancel</Button>
        <Button type="submit" variant="primary" disabled={saving} aria-busy={saving}>
          {saving ? 'Saving...' : mode === 'edit' ? 'Save changes' : 'Add device'}
        </Button>
      </div>
    </form>
  )
}
