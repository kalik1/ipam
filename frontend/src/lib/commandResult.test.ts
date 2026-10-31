import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AgentResult } from '../types'
import { awaitCommandResult, formatValue, resultSections } from './commandResult'

function result(id: string): AgentResult {
  return { id, ok: true, data: { devices: [] }, receivedAt: '2026-10-31T10:00:00.000Z' }
}

describe('awaitCommandResult', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('resolves with the latest result once it carries the command id', async () => {
    const fetchResult = vi
      .fn<() => Promise<AgentResult>>()
      .mockResolvedValueOnce(result('older-command'))
      .mockResolvedValueOnce(result('cmd-1'))

    const outcome = awaitCommandResult({ fetchResult, commandId: 'cmd-1', intervalMs: 1000, timeoutMs: 10_000 })
    await vi.advanceTimersByTimeAsync(2000)

    await expect(outcome).resolves.toEqual(result('cmd-1'))
    expect(fetchResult).toHaveBeenCalledTimes(2)
  })

  it('keeps waiting while the agent has no result yet', async () => {
    const fetchResult = vi
      .fn<() => Promise<AgentResult>>()
      .mockRejectedValueOnce(new Error('404'))
      .mockResolvedValueOnce(result('cmd-1'))

    const outcome = awaitCommandResult({ fetchResult, commandId: 'cmd-1', intervalMs: 1000, timeoutMs: 10_000 })
    await vi.advanceTimersByTimeAsync(2000)

    await expect(outcome).resolves.toEqual(result('cmd-1'))
  })

  it('gives up with no result after the timeout and stops asking', async () => {
    const fetchResult = vi.fn<() => Promise<AgentResult>>().mockResolvedValue(result('other-command'))

    const outcome = awaitCommandResult({ fetchResult, commandId: 'cmd-1', intervalMs: 1000, timeoutMs: 3000 })
    await vi.advanceTimersByTimeAsync(10_000)

    await expect(outcome).resolves.toBeNull()
    expect(fetchResult).toHaveBeenCalledTimes(3)
  })

  it('stops asking when the wait is aborted', async () => {
    const fetchResult = vi.fn<() => Promise<AgentResult>>().mockResolvedValue(result('other-command'))
    const controller = new AbortController()

    const outcome = awaitCommandResult({
      fetchResult,
      commandId: 'cmd-1',
      intervalMs: 1000,
      timeoutMs: 10_000,
      signal: controller.signal,
    })
    await vi.advanceTimersByTimeAsync(1000)
    controller.abort()
    await vi.advanceTimersByTimeAsync(10_000)

    await expect(outcome).resolves.toBeNull()
    expect(fetchResult).toHaveBeenCalledTimes(1)
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
