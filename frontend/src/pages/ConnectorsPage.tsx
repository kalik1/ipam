import { useCallback, useEffect, useState, type FormEvent } from 'react'
import {
  createConnector,
  deleteConnector,
  getConnectors,
  getErrorMessage,
  updateConnector,
  type ConnectorBody,
} from '@/lib/api'
import { timeAgo } from '@/lib/format'
import {
  CONNECTOR_FIELDS,
  CONNECTOR_TYPES,
  parseJsonObject,
  summarizeConfig,
} from '@/lib/connectors'
import type { Connector } from '@/types'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { EmptyState } from '@/components/EmptyState'
import { FormField, inputClass } from '@/components/FormField'
import { Modal } from '@/components/Modal'

export default function ConnectorsPage() {
  const [connectors, setConnectors] = useState<Connector[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [editing, setEditing] = useState<Connector | null>(null)
  const [showCreate, setShowCreate] = useState(false)
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

  function closeModal() {
    setShowCreate(false)
    setEditing(null)
    void load()
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm text-slate-400">Connection profiles that can be scheduled on agents</p>
        <button
          onClick={() => {
            setEditing(null)
            setShowCreate(true)
          }}
          className="btn btn-primary"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" className="h-4 w-4" aria-hidden="true">
            <path d="M12 5v14M5 12h14" />
          </svg>
          New connector
        </button>
      </div>

      {error && (
        <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">{error}</p>
      )}

      <div className="card overflow-hidden">
        <table className="w-full text-left">
          <thead className="border-b border-slate-800">
            <tr>
              <th className="th">Label</th>
              <th className="th">Name</th>
              <th className="th">Config</th>
              <th className="th">Created</th>
              <th className="th">Updated</th>
              <th className="th text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {loading ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                  Loading...
                </td>
              </tr>
            ) : connectors.length === 0 ? (
              <tr>
                <td colSpan={6}>
                  <EmptyState title="No connectors" message="Create a connector to define a connection profile for agents" />
                </td>
              </tr>
            ) : (
              connectors.map((connector) => (
                <tr key={connector.id} className="transition-colors hover:bg-slate-800/40">
                  <td className="td font-medium text-slate-200">{connector.label || '—'}</td>
                  <td className="td">
                    <span className="rounded-md bg-slate-800 px-2 py-0.5 text-xs text-slate-300">{connector.name}</span>
                  </td>
                  <td className="td font-mono text-xs text-slate-400">{summarizeConfig(connector.name, connector.config)}</td>
                  <td className="td tabular-nums">{new Date(connector.createdAt).toLocaleDateString()}</td>
                  <td className="td">{timeAgo(connector.updatedAt)}</td>
                  <td className="td text-right">
                    <div className="flex justify-end gap-3">
                      <button
                        onClick={() => {
                          setShowCreate(false)
                          setEditing(connector)
                        }}
                        className="text-indigo-400 transition-colors hover:text-indigo-300"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => setToDelete(connector)}
                        className="text-red-400 transition-colors hover:text-red-300"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {(showCreate || editing) && (
        <Modal title={editing ? 'Edit connector' : 'New connector'} onClose={closeModal}>
          <ConnectorForm
            key={editing?.id ?? 'new'}
            initial={editing}
            onClose={closeModal}
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
          message={`Delete connector "${toDelete.label || toDelete.name}"? Agents using it will lose the assignment.`}
          loading={deleting}
          onConfirm={handleDelete}
          onCancel={() => setToDelete(null)}
        />
      )}
    </div>
  )
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
  const [fields, setFields] = useState<Record<string, string>>(() => {
    const next: Record<string, string> = {}
    const defs = CONNECTOR_FIELDS[initial?.name ?? '']
    if (defs) {
      for (const field of defs) {
        const value = initial?.config[field.key]
        next[field.key] = value == null ? (field.default ?? '') : String(value)
      }
    }
    return next
  })
  const [rawConfig, setRawConfig] = useState(() =>
    initial && !CONNECTOR_FIELDS[initial.name] ? JSON.stringify(initial.config, null, 2) : '',
  )
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const defs = CONNECTOR_FIELDS[name]
  const isKnown = defs !== undefined

  useEffect(() => {
    const nextDefs = CONNECTOR_FIELDS[name]
    if (!nextDefs) return
    const next: Record<string, string> = {}
    for (const field of nextDefs) {
      const value = initial?.config[field.key]
      next[field.key] = value == null ? (field.default ?? '') : String(value)
    }
    setFields(next)
  }, [name, initial])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const trimmedName = name.trim()
    if (!trimmedName) {
      setError('Name is required')
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
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-400">{error}</p>
      )}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <FormField label="Name (type)" hint="Connector type, e.g. mikrotik">
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
        <FormField label="Label" hint="Human-readable name shown in lists">
          <input
            className={inputClass}
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Router 1"
          />
        </FormField>
      </div>
      {isKnown &&
        defs.map((field) => (
          <FormField key={field.key} label={field.label}>
            <input
              type={field.type === 'number' ? 'number' : field.type === 'password' ? 'password' : 'text'}
              className={inputClass}
              value={fields[field.key] ?? ''}
              onChange={(e) => setFields((prev) => ({ ...prev, [field.key]: e.target.value }))}
            />
          </FormField>
        ))}
      {!isKnown && (
        <FormField label="Config (JSON)" hint='JSON object, e.g. {"host": "192.168.1.1"}'>
          <textarea
            className={`${inputClass} min-h-24 font-mono`}
            value={rawConfig}
            onChange={(e) => setRawConfig(e.target.value)}
            placeholder='{"host": "192.168.1.1"}'
          />
        </FormField>
      )}
      <div className="flex justify-end gap-3 pt-2">
        <button type="button" onClick={onClose} className="btn btn-secondary">
          Cancel
        </button>
        <button type="submit" disabled={saving} className="btn btn-primary">
          {saving ? 'Saving...' : initial ? 'Save changes' : 'Create connector'}
        </button>
      </div>
    </form>
  )
}
