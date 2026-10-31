import { describe, expect, it } from 'vitest'
import { breadcrumbs } from './nav'

const names = { vlans: {}, subnets: {} }

describe('breadcrumbs', () => {
  it('shows the page name for top-level pages', () => {
    expect(breadcrumbs('/', names)).toEqual([{ label: 'Dashboard' }])
    expect(breadcrumbs('/api-keys', names)).toEqual([{ label: 'API keys' }])
    expect(breadcrumbs('/scan-reports', names)).toEqual([{ label: 'Scan reports' }])
  })

  it('links detail pages back to their list and names the record', () => {
    const known = { vlans: { 1: 'VLAN 10, Management' }, subnets: { 4: 'Users LAN' } }

    expect(breadcrumbs('/subnets/4', known)).toEqual([{ label: 'Subnets', to: '/subnets' }, { label: 'Users LAN' }])
    expect(breadcrumbs('/vlans/1', known)).toEqual([{ label: 'VLANs', to: '/vlans' }, { label: 'VLAN 10, Management' }])
  })

  it('falls back to a generic name while the record is unknown', () => {
    expect(breadcrumbs('/subnets/99', names)).toEqual([{ label: 'Subnets', to: '/subnets' }, { label: 'Subnet detail' }])
    expect(breadcrumbs('/vlans/7', names)).toEqual([{ label: 'VLANs', to: '/vlans' }, { label: 'VLAN detail' }])
  })
})
