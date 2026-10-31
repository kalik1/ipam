import { describe, expect, it } from 'vitest'
import type { AgentResult } from '../types'
import { commandOutcome, formatValue, resultSections } from './commandResult'

const NOW = '2026-10-31T10:00:05.000Z'

function result(id: string): AgentResult {
  return { id, ok: true, data: { devices: [] }, receivedAt: '2026-10-31T10:00:00.000Z' }
}

describe('commandOutcome', () => {
  it('shows the data of the agent result once the command result event arrived', () => {
    const outcome = commandOutcome('cmd-1', { commandId: 'cmd-1', agent: 'probe', ok: true }, result('cmd-1'), NOW)

    expect(outcome).toEqual({ status: 'done', result: result('cmd-1') })
  })

  it('shows the error of a failed command even when the agent already has a newer result', () => {
    const outcome = commandOutcome(
      'cmd-1',
      { commandId: 'cmd-1', agent: 'probe', ok: false, error: 'connect ECONNREFUSED' },
      result('cmd-2'),
      NOW,
    )

    expect(outcome).toEqual({ status: 'done', result: { id: 'cmd-1', ok: false, error: 'connect ECONNREFUSED', receivedAt: NOW } })
  })

  it('shows a successful command without data when its result is no longer the latest one', () => {
    const outcome = commandOutcome('cmd-1', { commandId: 'cmd-1', agent: 'probe', ok: true }, null, NOW)

    expect(outcome).toEqual({ status: 'done', result: { id: 'cmd-1', ok: true, receivedAt: NOW } })
  })

  it('still finds the result without its event when the agent result carries the command id', () => {
    expect(commandOutcome('cmd-1', undefined, result('cmd-1'), NOW)).toEqual({ status: 'done', result: result('cmd-1') })
  })

  it('times out without the event and without a matching agent result', () => {
    expect(commandOutcome('cmd-1', undefined, result('cmd-0'), NOW)).toEqual({ status: 'timeout' })
    expect(commandOutcome('cmd-1', undefined, null, NOW)).toEqual({ status: 'timeout' })
  })
})

describe('resultSections', () => {
  it('lists the devices, subnets and VLANs a connector returned', () => {
    const sections = resultSections({
      devices: [{ ip: '192.168.1.10', mac: 'AA:BB:CC:00:11:22' }],
      subnets: [{ cidr: '192.168.1.0/24', name: 'Users', vlanId: 20 }],
      vlans: [{ vlanId: 20, name: 'Users' }],
    })

    expect(sections.devices).toEqual([{ ip: '192.168.1.10', mac: 'AA:BB:CC:00:11:22' }])
    expect(sections.subnets).toEqual([{ cidr: '192.168.1.0/24', name: 'Users', vlanId: 20 }])
    expect(sections.vlans).toEqual([{ vlanId: 20, name: 'Users' }])
    expect(sections.empty).toBe(false)
  })

  it('names a subnet VLAN from the VLANs of the same result, or shows its tag', () => {
    const sections = resultSections({ vlans: [{ vlanId: 20, name: 'Users' }] })

    expect(sections.vlanName(20)).toBe('Users')
    expect(sections.vlanName(30)).toBe('30')
    expect(sections.vlanName(undefined)).toBeNull()
  })

  it('ignores sections that are not lists and keeps metadata as is', () => {
    const sections = resultSections({ devices: 'none', meta: { router: 'core-1' } })

    expect(sections.devices).toEqual([])
    expect(sections.meta).toEqual({ router: 'core-1' })
    expect(sections.empty).toBe(false)
  })

  it('reports a result with no data as empty', () => {
    expect(resultSections(undefined).empty).toBe(true)
  })
})

describe('formatValue', () => {
  it('prints scalars as text and objects as JSON', () => {
    expect(formatValue('core-1')).toBe('core-1')
    expect(formatValue(8728)).toBe('8728')
    expect(formatValue({ a: 1 })).toBe('{"a":1}')
  })

  it('has no text for a missing value', () => {
    expect(formatValue(undefined)).toBeNull()
    expect(formatValue(null)).toBeNull()
  })
})
