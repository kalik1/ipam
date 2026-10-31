import type { Device, Subnet } from '@/types'
import type { FormMode, SelectOption } from './subnetForm'

export interface DeviceDraft {
  ip: string
  mac: string
  hostname: string
  vendor: string
  subnetId: string
  notes: string
}

export interface DeviceBody {
  ip: string
  mac: string
  hostname: string
  vendor: string
  notes: string
  subnetId?: number | null
}

export function subnetOptions(subnets: Pick<Subnet, 'id' | 'name' | 'cidr'>[]): SelectOption[] {
  return subnets.map((subnet) => ({ value: String(subnet.id), label: `${subnet.name} (${subnet.cidr})` }))
}

export function deviceDraft(device?: Device): DeviceDraft {
  return {
    ip: device?.ip ?? '',
    mac: device?.mac ?? '',
    hostname: device?.hostname ?? '',
    vendor: device?.vendor ?? '',
    subnetId: device?.subnetId == null ? '' : String(device.subnetId),
    notes: device?.notes ?? '',
  }
}

export function deviceBody(draft: DeviceDraft, mode: FormMode): DeviceBody {
  const body: DeviceBody = {
    ip: draft.ip.trim(),
    mac: draft.mac.trim(),
    hostname: draft.hostname.trim(),
    vendor: draft.vendor.trim(),
    notes: draft.notes.trim(),
  }
  if (draft.subnetId) body.subnetId = Number(draft.subnetId)
  else if (mode === 'edit') body.subnetId = null
  return body
}
