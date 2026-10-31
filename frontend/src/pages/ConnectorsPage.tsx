import { useCallback, useEffect, useState, type FormEvent } from 'react'
import {
  createConnector,
  deleteConnector,
  getConnectors,
  getErrorMessage,
  updateConnector,
  type ConnectorBody,
} from '@/lib/api'
import { CONNECTOR_FIELDS, CONNECTOR_TYPES, parseJsonObject, summarizeConfig } from '@/lib/connectors'
import { formatDay, timeAgo } from '@/lib/format'
import type { Connector } from '@/types'
import { Button } from '@/components/Button'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { EmptyState } from '@/components/EmptyState'
import { FormField, inputClass } from '@/components/FormField'
import { Modal } from '@/components/Modal'
import { Panel, PanelHeader } from '@/components/Panel'
import { Table, TableMessage } from '@/components/Table'
import { PageActions } from '@/components/shell/PageActions'

const COLUMNS = 6

type ConnectorFormState = { mode: 'create' } | { mode: 'edit'; connector: Connector }

export default function ConnectorsPage() {
  const [connectors, setConnectors] = useState<Connector[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [form, setForm] = useState<ConnectorFormState | null>(null)
  const [toDelete, setToDelete] = useState<Connector | null>(null)
  const [deleting, setDeleting] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await getConnectors()
      setConnectors(data)
      setError('')
    } catch (e) {
      setError(getErrorMessage(e, 'Failed to load connectors'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function handleDelete() {
    if (!toDelete) return
    setDeleting(true)
    try {
      await deleteConnector(toDelete.id)
      setConnectors((list) => list.filter((c) => c.id !== toDelete.id))
      setToDelete(null)
      setError('')
    } catch (e) {
      setError(getErrorMessage(e, 'Failed to delete connector'))
      setToDelete(null)
    } finally {
      setDeleting(false)
    }
  }

  function closeForm() {
    setForm(null)
    void load()
  }

  const editing = form?.mode === 'edit' ? form.connector : null

  return (
    <>
      <PageActions>
        <Button variant="primary" onClick={() => setForm({ mode: 'create' })}>
          Add connector
        </Button>
      </PageActions>

      {error && (
        <p className="alert" role="alert">
          {error}
        </p>
      )}

      <Panel aria-label="Connectors">
        <PanelHeader title="Connectors">
          <span className="list-count">
            {loading && connectors.length === 0
              ? 'Loading'
              : `${connectors.length} connection ${connectors.length === 1 ? 'profile' : 'profiles'} agents can scan`}
          </span>
        </PanelHeader>
        <Table>
          <thead>
            <tr>
              <th>Label</th>
              <th>Type</th>
              <th>Config</th>
              <th>Created</th>
              <th>Updated</th>
              <th className="num">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && connectors.length === 0 ? (
              <TableMessage colSpan={COLUMNS}>Loading connectors...</TableMessage>
            ) : connectors.length === 0 ? (
              <TableMessage colSpan={COLUMNS}>
                <EmptyState title="No connectors" message="Add a connector to give agents a device they can scan" />
              </TableMessage>
            ) : (
              connectors.map((connector) => (
                <tr key={connector.id}>
                  <td className="font-semibold">{connector.label || <span className="cell-muted">No label</span>}</td>
                  <td>
                    <span className="tag">{connector.name}</span>
                  </td>
                  <td className="mono cell-trunc text-fg-2">{summarizeConfig(connector.name, connector.config)}</td>
                  <td className="mono text-fg-2">{formatDay(connector.createdAt)}</td>
                  <td className="text-fg-2">{timeAgo(connector.updatedAt)}</td>
                  <td>
                    <div className="row-actions">
                      <Button
                        variant="ghost"
                        aria-label={`Edit connector ${connector.label || connector.name}`}
                        onClick={() => setForm({ mode: 'edit', connector })}
                      >
                        Edit
                      </Button>
                      <Button
                        variant="danger"
                        aria-label={`Delete connector ${connector.label || connector.name}`}
                        onClick={() => setToDelete(connector)}
                      >
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
        <Modal title={editing ? 'Edit connector' : 'Add connector'} onClose={closeForm}>
          <ConnectorForm
            key={editing?.id ?? 'new'}
            initial={editing}
            onClose={closeForm}
            onSubmit={async (body) => {
              if (editing) {
                await updateConnector(editing.id, body)
              } else {
                await createConnector(body)
              }
            }}
          />
        </Modal>
      )}

      {toDelete && (
        <ConfirmDialog
          title="Delete connector"
          message={`Delete connector "${toDelete.label || toDelete.name}"? Agents lose their assignments to it.`}
          confirmLabel="Delete connector"
          loading={deleting}
          onConfirm={handleDelete}
          onCancel={() => setToDelete(null)}
        />
      )}
    </>
  )
}

function fieldValues(name: string, initial: Connector | null): Record<string, string> {
  const values: Record<string, string> = {}
  for (const field of CONNECTOR_FIELDS[name] ?? []) {
    const value = initial?.config[field.key]
    values[field.key] = value == null ? (field.default ?? '') : String(value)
  }
  return values
}

function ConnectorForm({
  initial,
  onSubmit,
  onClose,
}: {
  initial: Connector | null
  onSubmit: (body: ConnectorBody) => Promise<void>
  onClose: () => void
}) {
  const [name, setName] = useState(initial?.name ?? '')
  const [label, setLabel] = useState(initial?.label ?? '')
  const [fields, setFields] = useState<Record<string, string>>(() => fieldValues(initial?.name ?? '', initial))
  const [rawConfig, setRawConfig] = useState(() =>
    initial && !CONNECTOR_FIELDS[initial.name] ? JSON.stringify(initial.config, null, 2) : '',
  )
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const defs = CONNECTOR_FIELDS[name]

  useEffect(() => {
    if (CONNECTOR_FIELDS[name]) setFields(fieldValues(name, initial))
  }, [name, initial])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const trimmedName = name.trim()
    if (!trimmedName) {
      setError('Type is required')
      return
    }
    let config: Record<string, unknown>
    const fieldDefs = CONNECTOR_FIELDS[trimmedName]
    if (fieldDefs) {
      config = {}
      for (const field of fieldDefs) {
        const value = (fields[field.key] ?? '').trim()
        if (!value) continue
        if (field.type === 'number' && Number.isNaN(Number(value))) {
          setError(`${field.label} must be a number`)
          return
        }
        config[field.key] = field.type === 'number' ? Number(value) : value
      }
    } else {
      const parsed = parseJsonObject(rawConfig)
      if (!parsed) {
        setError('Config must be a JSON object')
        return
      }
      config = parsed
    }
    if (Object.keys(config).length === 0) {
      setError('Config must not be empty')
      return
    }
    setSaving(true)
    setError('')
    try {
      await onSubmit({ name: trimmedName, label: label.trim() || undefined, config })
      onClose()
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to save connector'))
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
        <FormField label="Type" hint="Connector type, for example mikrotik">
          <input
            className={inputClass}
            value={name}
            onChange={(e) => setName(e.target.value)}
            list="connector-types"
            required
          />
          <datalist id="connector-types">
            {CONNECTOR_TYPES.map((type) => (
              <option key={type} value={type} />
            ))}
          </datalist>
        </FormField>
        <FormField label="Label" hint="Name shown in lists">
          <input className={inputClass} value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Core router" />
        </FormField>
      </div>
      {defs ? (
        <div className="cols-2">
          {defs.map((field) => (
            <FormField key={field.key} label={field.label}>
              <input
                type={field.type === 'number' ? 'number' : field.type === 'password' ? 'password' : 'text'}
                className={field.type === 'number' ? `${inputClass} mono` : inputClass}
                value={fields[field.key] ?? ''}
                onChange={(e) => setFields((prev) => ({ ...prev, [field.key]: e.target.value }))}
              />
            </FormField>
          ))}
        </div>
      ) : (
        <FormField label="Config (JSON)" hint='JSON object, for example {"host": "192.168.1.1"}'>
          <textarea
            className={`${inputClass} mono`}
            value={rawConfig}
            onChange={(e) => setRawConfig(e.target.value)}
            placeholder='{"host": "192.168.1.1"}'
          />
        </FormField>
      )}
      <div className="form-actions">
        <Button onClick={onClose}>Cancel</Button>
        <Button type="submit" variant="primary" disabled={saving} aria-busy={saving}>
          {saving ? 'Saving...' : initial ? 'Save changes' : 'Add connector'}
        </Button>
      </div>
    </form>
  )
}
