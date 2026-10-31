import { describe, expect, it } from 'vitest'
import { configFromFields, parseJsonObject, summarizeConfig } from './connectors'

describe('configFromFields', () => {
  it('builds config from structured fields, skipping blanks', () => {
    expect(
      configFromFields('mikrotik', { host: '192.168.1.1', port: '8728', username: 'admin', password: '' }),
    ).toEqual({ host: '192.168.1.1', port: 8728, username: 'admin' })
  })

  it('returns null for unknown connector types', () => {
    expect(configFromFields('other', { host: 'x' })).toBeNull()
  })

  it('returns an empty object when all fields are blank', () => {
    expect(configFromFields('mikrotik', {})).toEqual({})
  })
})

describe('parseJsonObject', () => {
  it('parses a JSON object', () => {
    expect(parseJsonObject('{"a": 1}')).toEqual({ a: 1 })
  })

  it('rejects arrays', () => {
    expect(parseJsonObject('[1, 2]')).toBeNull()
  })

  it('rejects invalid JSON', () => {
    expect(parseJsonObject('{nope')).toBeNull()
  })

  it('rejects blank input', () => {
    expect(parseJsonObject('   ')).toBeNull()
  })
})

describe('summarizeConfig', () => {
  it('summarizes mikrotik as host:port user', () => {
    expect(summarizeConfig('mikrotik', { host: '192.168.1.1', port: 8728, username: 'admin' })).toBe(
      '192.168.1.1:8728 admin',
    )
  })

  it('handles missing mikrotik fields', () => {
    expect(summarizeConfig('mikrotik', { host: '10.0.0.1' })).toBe('10.0.0.1')
  })

  it('falls back to JSON for unknown types', () => {
    expect(summarizeConfig('other', { a: 1 })).toBe('{"a":1}')
  })

  it('truncates long JSON', () => {
    const summary = summarizeConfig('other', { a: 'x'.repeat(80) })
    expect(summary.endsWith('...')).toBe(true)
    expect(summary.length).toBe(63)
  })
})
