import { useState, type FormEvent } from 'react'
import type { PoolUsage } from '@/lib/addressMap'
import { formatRange, splitIp } from '@/lib/addressMath'
import { getErrorMessage, type DhcpPoolBody } from '@/lib/api'
import { plural } from '@/lib/format'
import type { DhcpPool } from '@/types'
import { Button } from '@/components/Button'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { FormField, inputClass } from '@/components/FormField'
import { Panel } from '@/components/Panel'

export function NextFreePanel({ addresses, free, prefix, onPick }: { addresses: string[]; free: number; prefix: number; onPick: (ip: string) => void }) {
  return (
    <Panel className="side" aria-label="Next free addresses">
      <div className="sidehead">
        <h3>Next free addresses</h3>
        <span className="r">{plural(free, 'free address', 'free addresses')}</span>
      </div>
      {addresses.length === 0 ? (
        <p>No free addresses left in this subnet.</p>
      ) : (
        <div className="freegrid">
          {addresses.map((ip) => (
            <button key={ip} type="button" className="freechip" aria-label={`Select ${ip}`} onClick={() => onPick(ip)}>
              .{splitIp(ip, prefix).host}
            </button>
          ))}
        </div>
      )}
    </Panel>
  )
}

function PoolMeter({ usage, cable }: { usage: PoolUsage; cable: string }) {
  const percent = (count: number) => (usage.size > 0 ? (count / usage.size) * 100 : 0)
  return (
    <div className="poolmeter" role="img" aria-label={`${usage.devices} of ${usage.size} pool addresses have a device`}>
      <i style={{ width: `${percent(usage.online)}%`, background: cable }} />
      <i style={{ width: `${percent(usage.devices - usage.online)}%`, background: cable, opacity: 0.42 }} />
    </div>
  )
}

function PoolForm({ onAdd }: { onAdd: (body: DhcpPoolBody) => Promise<void> }) {
  const [name, setName] = useState('')
  const [startIp, setStartIp] = useState('')
  const [endIp, setEndIp] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setSaving(true)
    setError('')
    try {
      await onAdd({ name: name.trim() || undefined, startIp: startIp.trim(), endIp: endIp.trim() })
      setName('')
      setStartIp('')
      setEndIp('')
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to add the pool'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2">
      <div className="poolform">
        <FormField label="Name">
          <input className={inputClass} value={name} onChange={(event) => setName(event.target.value)} placeholder="Optional" />
        </FormField>
        <FormField label="Start IP">
          <input className={`${inputClass} mono`} value={startIp} onChange={(event) => setStartIp(event.target.value)} required />
        </FormField>
        <FormField label="End IP">
          <input className={`${inputClass} mono`} value={endIp} onChange={(event) => setEndIp(event.target.value)} required />
        </FormField>
        <Button type="submit" disabled={saving} aria-busy={saving}>
          {saving ? 'Adding...' : 'Add pool'}
        </Button>
      </div>
      {error && <p className="alert">{error}</p>}
    </form>
  )
}

interface DhcpPoolPanelProps {
  pools: PoolUsage[]
  cable: string
  onAdd: (body: DhcpPoolBody) => Promise<void>
  onDelete: (pool: DhcpPool) => Promise<void>
}

export function DhcpPoolPanel({ pools, cable, onAdd, onDelete }: DhcpPoolPanelProps) {
  const [toDelete, setToDelete] = useState<DhcpPool | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState('')

  async function confirmDelete() {
    if (!toDelete) return
    setDeleting(true)
    setError('')
    try {
      await onDelete(toDelete)
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to delete the pool'))
    } finally {
      setDeleting(false)
      setToDelete(null)
    }
  }

  return (
    <Panel className="side" aria-label="DHCP pools">
      {pools.length === 0 && (
        <>
          <div className="sidehead">
            <h3>DHCP pools</h3>
          </div>
          <p>No DHCP pool in this subnet. Add one to keep its addresses reserved for the DHCP server.</p>
        </>
      )}
      {pools.map((usage) => (
        <div className="pool" key={usage.pool.id}>
          <div className="sidehead">
            <h3>DHCP pool: {usage.pool.name.trim() || 'Unnamed'}</h3>
            <span className="r mono">{formatRange(usage.pool.startIp, usage.pool.endIp)}</span>
          </div>
          <PoolMeter usage={usage} cable={cable} />
          <p>
            {plural(usage.devices, 'device', 'devices')} seen in the pool, {usage.online} of them online. The other{' '}
            {plural(usage.reserved, 'address stays', 'addresses stay')} reserved for DHCP.
          </p>
          <div>
            <Button variant="danger" onClick={() => setToDelete(usage.pool)}>
              Delete pool
            </Button>
          </div>
        </div>
      ))}
      {error && <p className="alert">{error}</p>}
      <PoolForm onAdd={onAdd} />
      {toDelete && (
        <ConfirmDialog
          title="Delete DHCP pool"
          message={`Delete the DHCP pool ${toDelete.name.trim() || 'Unnamed'} (${formatRange(toDelete.startIp, toDelete.endIp)})? Its addresses with no device become free, except gateways.`}
          confirmLabel="Delete pool"
          loading={deleting}
          onConfirm={() => void confirmDelete()}
          onCancel={() => setToDelete(null)}
        />
      )}
    </Panel>
  )
}
