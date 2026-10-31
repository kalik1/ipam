import { describe, expect, it } from 'vitest'
import { deviceBody, deviceDraft, subnetOptions, type DeviceDraft } from './deviceForm'
import type { Device, Subnet } from '@/types'

function draft(patch: Partial<DeviceDraft>): DeviceDraft {
  return { ...deviceDraft(), ip: '10.0.20.5', ...patch }
}

describe('subnetOptions', () => {
  it('labels each subnet with its CIDR and uses the subnet id as value', () => {
    const subnets = [{ id: 4, name: 'Users LAN', cidr: '192.168.1.0/24' }] as Subnet[]
    expect(subnetOptions(subnets)).toEqual([{ value: '4', label: 'Users LAN (192.168.1.0/24)' }])
  })
})

describe('deviceDraft', () => {
  it('copies an existing device, with no subnet as an empty selection', () => {
    const device = { ip: '10.9.9.9', mac: 'AA', hostname: 'h', vendor: 'v', notes: 'n', subnetId: null } as unknown as Device
    expect(deviceDraft(device)).toEqual({ ip: '10.9.9.9', mac: 'AA', hostname: 'h', vendor: 'v', subnetId: '', notes: 'n' })
  })
})

describe('deviceBody', () => {
  it('sends the selected subnet id as a number', () => {
    expect(deviceBody(draft({ subnetId: '3' }), 'create').subnetId).toBe(3)
  })

  it('omits the subnet on create so the backend picks it from the IP', () => {
    expect(deviceBody(draft({ subnetId: '' }), 'create')).not.toHaveProperty('subnetId')
  })

  it('clears the subnet with null when none is selected on edit', () => {
    expect(deviceBody(draft({ subnetId: '' }), 'edit').subnetId).toBeNull()
  })

  it('trims every field and keeps cleared ones as empty strings', () => {
    expect(deviceBody(draft({ ip: ' 10.0.20.5 ', mac: ' aa:bb:cc:dd:ee:ff ', hostname: '  ', notes: ' x ' }), 'edit')).toEqual({
      ip: '10.0.20.5',
      mac: 'aa:bb:cc:dd:ee:ff',
      hostname: '',
      vendor: '',
      notes: 'x',
      subnetId: null,
    })
  })
})
