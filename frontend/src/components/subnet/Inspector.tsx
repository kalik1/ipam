import { useEffect, useState, type FormEvent } from 'react'
import { addressRole, type AddressMapPool, type AddressRole, type AddressSlot } from '@/lib/addressMap'
import { addressMath, formatRange, splitMac } from '@/lib/addressMath'
import { getErrorMessage } from '@/lib/api'
import { formatDay, timeAgo } from '@/lib/format'
import { stateLabel } from '@/lib/portGlyph'
import type { Device } from '@/types'
import { Button } from '@/components/Button'
import { FormField, inputClass } from '@/components/FormField'
import { Panel } from '@/components/Panel'
import { StatusLed } from '@/components/StatusLed'

export interface AssignBody {
  hostname: string
  mac: string
}

const ROLE_LABEL: Record<AddressRole, string> = {
  gateway: 'Gateway',
  'dhcp-client': 'DHCP client',
  static: 'Static address',
}

function poolLabel(pool: AddressMapPool): string {
  return `${pool.name.trim() || 'Unnamed pool'} (${formatRange(pool.startIp, pool.endIp)})`
}

function CopyButton({ ip }: { ip: string }) {
  const [result, setResult] = useState<'idle' | 'copied' | 'failed'>('idle')

  useEffect(() => {
    if (result === 'idle') return
    const timer = setTimeout(() => setResult('idle'), 1500)
    return () => clearTimeout(timer)
  }, [result])

  async function copy() {
    try {
      await navigator.clipboard.writeText(ip)
      setResult('copied')
    } catch {
      setResult('failed')
    }
  }

  return (
    <Button onClick={() => void copy()} aria-live="polite">
      {result === 'copied' ? 'Copied' : result === 'failed' ? 'Copy failed' : 'Copy IP'}
    </Button>
  )
}

function DeviceDetails({ device, slot, onEdit, onDelete }: { device: Device; slot: AddressSlot<Device> | null; onEdit: () => void; onDelete: () => void }) {
  const online = device.status === 'online'
  const mac = splitMac(device.mac)
  const pools = slot?.pools ?? []
  const role = slot ? addressRole(slot) : 'static'
  return (
    <div className="inspbody">
      <div className="status">
        <StatusLed state={online ? 'on' : 'off'} />
        {online ? 'Online' : `Offline, last seen ${timeAgo(device.lastSeen)}`}
      </div>
      <h3 className="host">{device.hostname.trim() || 'Unnamed device'}</h3>
      <dl className="kv">
        <div>
          <dt>MAC address</dt>
          <dd className={device.mac ? 'mono' : undefined} title={device.mac}>
            {device.mac ? (
              <>
                <span className="oui">{mac.oui}</span>
                {mac.nic}
              </>
            ) : (
              'Unknown'
            )}
          </dd>
        </div>
        <div>
          <dt>Vendor</dt>
          <dd title={device.vendor}>{device.vendor || 'Unknown'}</dd>
        </div>
        <div>
          <dt>Last seen</dt>
          <dd>{timeAgo(device.lastSeen)}</dd>
        </div>
        <div>
          <dt>First seen</dt>
          <dd>{formatDay(device.createdAt)}</dd>
        </div>
        <div>
          <dt>DHCP pool</dt>
          <dd>{pools.length > 0 ? pools.map((pool) => pool.name.trim() || 'Unnamed pool').join(', ') : 'Outside the pools'}</dd>
        </div>
        <div>
          <dt>Role</dt>
          <dd>{ROLE_LABEL[role]}</dd>
        </div>
      </dl>
      <p className="note">{device.notes.trim() || 'No notes yet.'}</p>
      <div className="actions">
        <Button variant="primary" onClick={onEdit}>
          Edit device
        </Button>
        <CopyButton key={device.ip} ip={device.ip} />
        <Button variant="danger" onClick={onDelete}>
          Delete device
        </Button>
      </div>
    </div>
  )
}

function AssignForm({ onAssign }: { onAssign: (body: AssignBody) => Promise<void> }) {
  const [hostname, setHostname] = useState('')
  const [mac, setMac] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setSaving(true)
    setError('')
    try {
      await onAssign({ hostname: hostname.trim(), mac: mac.trim() })
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to assign the address'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <form className="inspbody" onSubmit={handleSubmit}>
      <p className="desc">Nothing has been seen on this address. Assign it to a device to keep it from being handed out twice.</p>
      {error && <p className="alert">{error}</p>}
      <FormField label="Hostname">
        <input className={inputClass} value={hostname} onChange={(event) => setHostname(event.target.value)} placeholder="e.g. printer-4f" />
      </FormField>
      <FormField label="MAC address">
        <input className={`${inputClass} mono`} value={mac} onChange={(event) => setMac(event.target.value)} placeholder="00:00:00:00:00:00" />
      </FormField>
      <div className="actions">
        <Button type="submit" variant="primary" disabled={saving} aria-busy={saving}>
          {saving ? 'Assigning...' : 'Assign address'}
        </Button>
      </div>
    </form>
  )
}

function Explanation({ slot, cidr }: { slot: AddressSlot<Device>; cidr: string }) {
  const lines: string[] = []
  if (slot.notUsable === 'network') lines.push(`Network address of ${cidr}. It identifies the subnet and is never assigned.`)
  if (slot.notUsable === 'broadcast') lines.push(`Broadcast address of ${cidr}. Packets sent here reach every device in the subnet.`)
  if (slot.state === 'reserved' && slot.gateway) lines.push(`This address is a gateway of ${cidr}. It is kept for the router, so it cannot be assigned by hand.`)
  if (slot.state === 'reserved') {
    for (const pool of slot.pools) {
      lines.push(`This address belongs to the DHCP pool ${poolLabel(pool)}. The DHCP server hands it out, so it cannot be assigned by hand.`)
    }
  }
  if (lines.length === 0) return null
  return (
    <div className="inspbody">
      {lines.map((line) => (
        <p className="desc" key={line}>
          {line}
        </p>
      ))}
    </div>
  )
}

function AddressMathList({ ip, cidr, includeFirstLast }: { ip: string; cidr: string; includeFirstLast: boolean }) {
  const math = addressMath(ip, cidr, includeFirstLast)
  return (
    <div className="inspbody">
      <dl className="bin" aria-label="Address math">
        <div>
          <dt>Binary</dt>
          <dd>
            <span className="nb">{math.networkBits}</span>
            <span className="hb">{math.hostBits}</span>
          </dd>
        </div>
        <div>
          <dt>Hex</dt>
          <dd>{math.hex}</dd>
        </div>
        <div>
          <dt>Decimal</dt>
          <dd>{math.decimal}</dd>
        </div>
        <div>
          <dt>PTR</dt>
          <dd title={math.ptr}>{math.ptr}</dd>
        </div>
        <div>
          <dt>Host</dt>
          <dd>{math.hostNumber === null ? 'Not a usable host' : `Host ${math.hostNumber.toLocaleString('en-US')} of ${math.usable.toLocaleString('en-US')}`}</dd>
        </div>
      </dl>
    </div>
  )
}

interface InspectorProps {
  ip: string
  slot: AddressSlot<Device> | null
  device: Device | null
  cidr: string
  includeFirstLast: boolean
  onAssign: (body: AssignBody) => Promise<void>
  onEdit: (device: Device) => void
  onDelete: (device: Device) => void
}

export function Inspector({ ip, slot, device, cidr, includeFirstLast, onAssign, onEdit, onDelete }: InspectorProps) {
  return (
    <Panel hud className="insp" aria-label="Selected address">
      <div className="insphead">
        <span className="ip">{ip}</span>
        <span className="state-tag">{slot ? stateLabel(slot.state) : 'Outside the subnet'}</span>
      </div>
      {!slot && (
        <div className="inspbody">
          <p className="desc">This address is outside {cidr}, so it has no place on the address map.</p>
        </div>
      )}
      {slot && <Explanation slot={slot} cidr={cidr} />}
      {device && <DeviceDetails device={device} slot={slot} onEdit={() => onEdit(device)} onDelete={() => onDelete(device)} />}
      {!device && slot?.state === 'free' && <AssignForm key={ip} onAssign={onAssign} />}
      <AddressMathList ip={ip} cidr={cidr} includeFirstLast={includeFirstLast} />
    </Panel>
  )
}
