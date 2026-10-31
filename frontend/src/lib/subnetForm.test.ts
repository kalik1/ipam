import { describe, expect, it } from 'vitest'
import { emptySubnetDraft, subnetBody, subnetDraft, vlanOptions, type SubnetDraft } from './subnetForm'
import type { Subnet, Vlan } from '@/types'

const vlans: Vlan[] = [
  { id: 1, vlanId: 10, name: 'Management', description: '', createdAt: '', updatedAt: '' },
  { id: 2, vlanId: 20, name: 'Users', description: '', createdAt: '', updatedAt: '' },
]

function draft(patch: Partial<SubnetDraft>): SubnetDraft {
  return { ...emptySubnetDraft(), name: 'Office', cidr: '10.0.20.0/24', ...patch }
}

describe('vlanOptions', () => {
  it('uses the VLAN row id as the option value, not the 802.1Q tag', () => {
    expect(vlanOptions(vlans)).toEqual([
      { value: '1', label: '10 - Management' },
      { value: '2', label: '20 - Users' },
    ])
  })
})

describe('subnetDraft', () => {
  it('preselects the VLAN of an existing subnet by row id', () => {
    const subnet = { vlanId: 2, gateways: [], dhcpPools: [] } as unknown as Subnet
    expect(subnetDraft(subnet).vlanId).toBe('2')
  })

  it('starts empty for a new subnet', () => {
    expect(subnetDraft().vlanId).toBe('')
  })
})

describe('subnetBody', () => {
  it('sends the selected VLAN row id as a number', () => {
    expect(subnetBody(draft({ vlanId: '2' }), 'create').vlanId).toBe(2)
  })

  it('omits the VLAN when none is selected on create', () => {
    expect(subnetBody(draft({ vlanId: '' }), 'create')).not.toHaveProperty('vlanId')
  })

  it('clears the VLAN with null when none is selected on edit', () => {
    expect(subnetBody(draft({ vlanId: '' }), 'edit').vlanId).toBeNull()
  })

  it('trims fields and drops empty gateways and incomplete pools', () => {
    const body = subnetBody(
      draft({
        name: '  Office  ',
        cidr: ' 10.0.20.0/24 ',
        gateways: [' 10.0.20.1 ', '  '],
        pools: [
          { name: ' clients ', startIp: '10.0.20.100', endIp: '10.0.20.199' },
          { name: '', startIp: '10.0.20.50', endIp: ' ' },
          { name: '  ', startIp: ' 10.0.20.10 ', endIp: '10.0.20.20' },
        ],
        description: '  ',
        dnsServers: ' 1.1.1.1 ',
      }),
      'create',
    )
    expect(body).toEqual({
      name: 'Office',
      cidr: '10.0.20.0/24',
      gateways: ['10.0.20.1'],
      includeFirstLast: false,
      dhcpPools: [
        { name: 'clients', startIp: '10.0.20.100', endIp: '10.0.20.199' },
        { startIp: '10.0.20.10', endIp: '10.0.20.20' },
      ],
      description: '',
      domainName: '',
      dnsServers: '1.1.1.1',
      ntpServers: '',
    })
  })

  it('sends cleared text fields as empty strings so an edit can remove them', () => {
    const body = subnetBody(draft({ description: '', domainName: ' ' }), 'edit')
    expect(body.description).toBe('')
    expect(body.domainName).toBe('')
  })
})
