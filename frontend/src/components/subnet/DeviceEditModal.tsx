import { useState, type FormEvent } from 'react'
import { getErrorMessage } from '@/lib/api'
import type { Device } from '@/types'
import { Button } from '@/components/Button'
import { FormField, inputClass } from '@/components/FormField'
import { Modal } from '@/components/Modal'

export interface DeviceEditBody {
  hostname: string
  mac: string
  vendor: string
  notes: string
}

export function DeviceEditModal({ device, onSave, onClose }: { device: Device; onSave: (body: DeviceEditBody) => Promise<void>; onClose: () => void }) {
  const [hostname, setHostname] = useState(device.hostname)
  const [mac, setMac] = useState(device.mac)
  const [vendor, setVendor] = useState(device.vendor)
  const [notes, setNotes] = useState(device.notes)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setSaving(true)
    setError('')
    try {
      await onSave({ hostname: hostname.trim(), mac: mac.trim(), vendor: vendor.trim(), notes: notes.trim() })
      onClose()
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to save the device'))
      setSaving(false)
    }
  }

  return (
    <Modal title={`Edit device ${device.ip}`} onClose={onClose}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {error && <p className="alert">{error}</p>}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField label="Hostname">
            <input className={inputClass} value={hostname} onChange={(event) => setHostname(event.target.value)} />
          </FormField>
          <FormField label="MAC address">
            <input className={`${inputClass} mono`} value={mac} onChange={(event) => setMac(event.target.value)} placeholder="00:00:00:00:00:00" />
          </FormField>
          <FormField label="Vendor">
            <input className={inputClass} value={vendor} onChange={(event) => setVendor(event.target.value)} />
          </FormField>
        </div>
        <FormField label="Notes">
          <textarea className={inputClass} value={notes} onChange={(event) => setNotes(event.target.value)} rows={3} />
        </FormField>
        <div className="flex justify-end gap-2">
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary" disabled={saving} aria-busy={saving}>
            {saving ? 'Saving...' : 'Save device'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
