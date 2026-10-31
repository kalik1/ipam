import { useCallback, useEffect, useState, type FormEvent } from 'react'
import api, { getErrorMessage } from '@/lib/api'
import { formatDay, timeAgo } from '@/lib/format'
import type { ApiKey, ApiKeyCreated } from '@/types'
import { Button } from '@/components/Button'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { EmptyState } from '@/components/EmptyState'
import { FormField, inputClass } from '@/components/FormField'
import { Modal } from '@/components/Modal'
import { Panel, PanelHeader } from '@/components/Panel'
import { Table, TableMessage } from '@/components/Table'
import { PageActions } from '@/components/shell/PageActions'

const COLUMNS = 5

export default function ApiKeysPage() {
  const [keys, setKeys] = useState<ApiKey[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [created, setCreated] = useState<ApiKeyCreated | null>(null)
  const [toDelete, setToDelete] = useState<ApiKey | null>(null)
  const [deleting, setDeleting] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await api.get<ApiKey[]>('/api-keys')
      setKeys(data)
      setError('')
    } catch (e) {
      setError(getErrorMessage(e, 'Failed to load API keys'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function handleCreate(name: string) {
    const { data } = await api.post<ApiKeyCreated>('/api-keys', { name })
    setCreated(data)
    setKeys((list) => [
      ...list,
      { id: data.id, name: data.name, keyPrefix: data.keyPrefix, createdAt: data.createdAt, lastUsedAt: data.lastUsedAt },
    ])
  }

  async function handleDelete() {
    if (!toDelete) return
    setDeleting(true)
    try {
      await api.delete(`/api-keys/${toDelete.id}`)
      setKeys((list) => list.filter((k) => k.id !== toDelete.id))
      if (created?.id === toDelete.id) setCreated(null)
      setToDelete(null)
      setError('')
    } catch (e) {
      setError(getErrorMessage(e, 'Failed to delete API key'))
      setToDelete(null)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <>
      <PageActions>
        <Button
          variant="primary"
          onClick={() => {
            setCreated(null)
            setShowCreate(true)
          }}
        >
          Create key
        </Button>
      </PageActions>

      {error && (
        <p className="alert" role="alert">
          {error}
        </p>
      )}

      {created && <CreatedKey created={created} onDone={() => setCreated(null)} onError={setError} />}

      <Panel aria-label="API keys">
        <PanelHeader title="API keys">
          <span className="list-count">
            {loading && keys.length === 0 ? 'Loading' : `${keys.length} ${keys.length === 1 ? 'key' : 'keys'} for agents to connect and report scans`}
          </span>
        </PanelHeader>
        <Table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Key prefix</th>
              <th>Created</th>
              <th>Last used</th>
              <th className="num">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && keys.length === 0 ? (
              <TableMessage colSpan={COLUMNS}>Loading API keys...</TableMessage>
            ) : keys.length === 0 ? (
              <TableMessage colSpan={COLUMNS}>
                <EmptyState title="No API keys" message="Create a key so an agent can connect and report scans" />
              </TableMessage>
            ) : (
              keys.map((key) => (
                <tr key={key.id}>
                  <td className="font-semibold">{key.name}</td>
                  <td className="mono text-fg-2">{key.keyPrefix}...</td>
                  <td className="mono text-fg-2">{formatDay(key.createdAt)}</td>
                  <td className="text-fg-2">{key.lastUsedAt ? timeAgo(key.lastUsedAt) : <span className="cell-muted">Never</span>}</td>
                  <td>
                    <div className="row-actions">
                      <Button variant="danger" aria-label={`Delete API key ${key.name}`} onClick={() => setToDelete(key)}>
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

      {showCreate && (
        <Modal title="Create API key" onClose={() => setShowCreate(false)}>
          <CreateKeyForm onSubmit={handleCreate} onClose={() => setShowCreate(false)} />
        </Modal>
      )}

      {toDelete && (
        <ConfirmDialog
          title="Delete API key"
          message={`Delete API key "${toDelete.name}"? Agents using it can no longer connect or report scans.`}
          confirmLabel="Delete key"
          loading={deleting}
          onConfirm={handleDelete}
          onCancel={() => setToDelete(null)}
        />
      )}
    </>
  )
}

function CreatedKey({
  created,
  onDone,
  onError,
}: {
  created: ApiKeyCreated
  onDone: () => void
  onError: (message: string) => void
}) {
  const [copied, setCopied] = useState(false)

  async function copyKey() {
    try {
      await navigator.clipboard.writeText(created.key)
      setCopied(true)
    } catch {
      onError('Failed to copy to the clipboard: select the key and copy it by hand')
    }
  }

  return (
    <Panel hud className="key-reveal" aria-label="New API key">
      <PanelHeader title={`Key created: ${created.name}`} />
      <div className="panel-body">
        <div className="key-row">
          <input
            readOnly
            aria-label="Full API key"
            value={created.key}
            onFocus={(e) => e.target.select()}
            className={`${inputClass} mono`}
          />
          <Button variant="primary" onClick={() => void copyKey()}>
            {copied ? 'Copied' : 'Copy key'}
          </Button>
        </div>
        <p className="key-note">This is the only time the full key is shown. IPAM stores only its hash: copy it now.</p>
        <div className="form-actions">
          <Button onClick={onDone}>Done</Button>
        </div>
      </div>
    </Panel>
  )
}

function CreateKeyForm({ onSubmit, onClose }: { onSubmit: (name: string) => Promise<void>; onClose: () => void }) {
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setSaving(true)
    setError('')
    try {
      await onSubmit(name.trim())
      onClose()
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to create API key'))
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
      <FormField label="Name" hint="A label for this key, for example the agent name">
        <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
      </FormField>
      <div className="form-actions">
        <Button onClick={onClose}>Cancel</Button>
        <Button type="submit" variant="primary" disabled={saving} aria-busy={saving}>
          {saving ? 'Creating...' : 'Create key'}
        </Button>
      </div>
    </form>
  )
}
