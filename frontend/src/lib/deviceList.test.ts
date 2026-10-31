import { describe, expect, it } from 'vitest'
import { filterByStatus, statusCounts } from './deviceList'

const devices = [
  { id: 1, status: 'online' as const },
  { id: 2, status: 'offline' as const },
  { id: 3, status: 'online' as const },
]

describe('statusCounts', () => {
  it('counts all, online and offline devices', () => {
    expect(statusCounts(devices)).toEqual({ all: 3, online: 2, offline: 1 })
  })

  it('counts zero for an empty list', () => {
    expect(statusCounts([])).toEqual({ all: 0, online: 0, offline: 0 })
  })
})

describe('filterByStatus', () => {
  it('keeps every device for all', () => {
    expect(filterByStatus(devices, 'all').map((d) => d.id)).toEqual([1, 2, 3])
  })

  it('keeps only devices with the chosen status', () => {
    expect(filterByStatus(devices, 'online').map((d) => d.id)).toEqual([1, 3])
    expect(filterByStatus(devices, 'offline').map((d) => d.id)).toEqual([2])
  })
})
