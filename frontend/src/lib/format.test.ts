import { describe, expect, it, vi, afterEach } from 'vitest'
import { formatClock, formatDay, formatTimestamp, plural, timeAgo } from './format'

afterEach(() => {
  vi.useRealTimers()
})

describe('timeAgo', () => {
  it('returns "just now" for the last 45 seconds', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-01T00:00:40Z'))
    expect(timeAgo('2026-01-01T00:00:00Z')).toBe('just now')
  })

  it('returns minutes', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-01T00:05:00Z'))
    expect(timeAgo('2026-01-01T00:02:00Z')).toBe('3m ago')
  })

  it('returns hours', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-01T03:00:00Z'))
    expect(timeAgo('2026-01-01T00:00:00Z')).toBe('3h ago')
  })

  it('returns days', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-04T00:00:00Z'))
    expect(timeAgo('2026-01-01T00:00:00Z')).toBe('3d ago')
  })

  it('returns months', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-03-15T00:00:00Z'))
    expect(timeAgo('2026-01-01T00:00:00Z')).toBe('2mo ago')
  })

  it('returns years', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2028-06-01T00:00:00Z'))
    expect(timeAgo('2026-06-01T00:00:00Z')).toBe('2y ago')
  })

  it('returns "unknown" for invalid dates', () => {
    expect(timeAgo('not-a-date')).toBe('unknown')
  })
})

describe('formatDay', () => {
  it('writes a date as month, day and year', () => {
    expect(formatDay('2026-03-02T10:00:00Z')).toBe('Mar 2, 2026')
  })

  it('returns "unknown" for invalid dates', () => {
    expect(formatDay('not-a-date')).toBe('unknown')
  })
})

describe('formatTimestamp', () => {
  it('writes local date and time with zero padding, sortable as text', () => {
    expect(formatTimestamp(new Date(2026, 2, 2, 9, 5, 7).toISOString())).toBe('2026-03-02 09:05:07')
  })

  it('returns "unknown" for invalid dates', () => {
    expect(formatTimestamp('not-a-date')).toBe('unknown')
  })
})

describe('formatClock', () => {
  it('shows the local time of day with seconds, on a 24 hour clock', () => {
    expect(formatClock(new Date(2026, 9, 31, 7, 4, 9).toISOString())).toBe('07:04:09')
    expect(formatClock(new Date(2026, 9, 31, 23, 59, 30).toISOString())).toBe('23:59:30')
  })

  it('returns a placeholder for an invalid date', () => {
    expect(formatClock('not a date')).toBe('--:--:--')
  })
})

describe('plural', () => {
  it('uses the singular only for exactly one', () => {
    expect(plural(1, 'device')).toBe('1 device')
    expect(plural(0, 'device')).toBe('0 devices')
    expect(plural(2, 'VLAN')).toBe('2 VLANs')
  })

  it('takes an irregular plural form', () => {
    expect(plural(1, 'address stays', 'addresses stay')).toBe('1 address stays')
    expect(plural(3, 'address stays', 'addresses stay')).toBe('3 addresses stay')
  })

  it('groups the digits of large counts', () => {
    expect(plural(65534, 'free address', 'free addresses')).toBe('65,534 free addresses')
  })
})
