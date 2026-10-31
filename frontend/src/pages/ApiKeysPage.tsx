import { useCallback, useEffect, useState, type FormEvent } from 'react'
import api, { getErrorMessage } from '@/lib/api'
import { timeAgo } from '@/lib/format'
import type { ApiKey, ApiKeyCreated } from '@/types'
import { Modal } from '@/components/Modal'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { FormField, inputClass } from '@/components/FormField'
import { EmptyState } from '@/components/EmptyState'

export default function ApiKeysPage() {
  const [keys, setKeys] = useState<ApiKey[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [created, setCreated] = useState<ApiKeyCreated | null>(null)
  const [copied, setCopied] = useState(false)
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
      setToDelete(null)
      setError('')
    } catch (e) {
      setError(getErrorMessage(e, 'Failed to delete API key'))
      setToDelete(null)
    } finally {
      setDeleting(false)
    }
  }

  async function copyKey() {
    if (!created) return
    try {
      await navigator.clipboard.writeText(created.key)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setError('Failed to copy to clipboard')
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm text-slate-400">Credentials for scan agents</p>
        <button
          onClick={() => {
            setCreated(null)
            setShowCreate(true)
          }}
          className="btn btn-primary"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" className="h-4 w-4" aria-hidden="true">
            <path d="M12 5v14M5 12h14" />
          </svg>
          New key
        </button>
      </div>

      {error && (
        <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">{error}</p>
      )}

      {created && (
        <div className="rounded-xl border border-indigo-500/40 bg-indigo-500/10 p-5">
          <p className="text-sm font-semibold text-indigo-300">API key created</p>
          <div className="mt-3 flex items-center gap-2">
            <input
              readOnly
              value={created.key}
              onFocus={(e) => e.target.select()}
              className={`${inputClass} font-mono text-xs`}
            />
            <button onClick={copyKey} className="btn btn-primary shrink-0">
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
          <p className="mt-2 text-xs text-amber-400">This key is shown only once. Store it somewhere safe.</p>
        </div>
      )}

      <div className="card overflow-hidden">
        <table className="w-full text-left">
          <thead className="border-b border-slate-800">
            <tr>
              <th className="th">Name</th>
              <th className="th">Key prefix</th>
              <th className="th">Created</th>
              <th className="th">Last used</th>
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
            ) : keys.length === 0 ? (
              <tr>
                <td colSpan={5}>
                  <EmptyState title="No API keys" message="Create a key so agents can submit scan reports" />
                </td>
              </tr>
            ) : (
              keys.map((key) => (
                <tr key={key.id} className="transition-colors hover:bg-slate-800/40">
                  <td className="td font-medium text-slate-200">{key.name}</td>
                  <td className="td font-mono">{key.keyPrefix}...</td>
                  <td className="td tabular-nums">{new Date(key.createdAt).toLocaleDateString()}</td>
                  <td className="td">{key.lastUsedAt ? timeAgo(key.lastUsedAt) : 'never'}</td>
                  <td className="td text-right">
                    <button
                      onClick={() => setToDelete(key)}
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

      {showCreate && (
        <Modal title="New API key" onClose={() => setShowCreate(false)}>
          <CreateKeyForm onSubmit={handleCreate} onClose={() => setShowCreate(false)} />
        </Modal>
      )}

      {toDelete && (
        <ConfirmDialog
          title="Delete API key"
          message={`Delete API key "${toDelete.name}"? Agents using it will stop working.`}
          loading={deleting}
          onConfirm={handleDelete}
          onCancel={() => setToDelete(null)}
        />
      )}
    </div>
  )
}

function CreateKeyForm({
  onSubmit,
  onClose,
}: {
  onSubmit: (name: string) => Promise<void>
  onClose: () => void
}) {
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
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-400">{error}</p>}
      <FormField label="Name" hint="A label for this key, e.g. the agent name">
        <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
      </FormField>
      <div className="flex justify-end gap-3 pt-2">
        <button type="button" onClick={onClose} className="btn btn-secondary">
          Cancel
        </button>
        <button type="submit" disabled={saving} className="btn btn-primary">
          {saving ? 'Creating...' : 'Create key'}
        </button>
      </div>
    </form>
  )
}
