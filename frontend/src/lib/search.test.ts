import { describe, expect, it } from 'vitest'
import {
  isSearchShortcut,
  isTypingTarget,
  matchDevices,
  resultPath,
  stepIndex,
  type SearchableDevice,
  type ShortcutEvent,
} from './search'

const usersLan = { id: 3, name: 'Users LAN', cidr: '192.168.1.0/24' }
const mgmtLan = { id: 1, name: 'Management LAN', cidr: '10.0.0.0/24' }

function device(id: number, ip: string, extra: Partial<SearchableDevice> = {}): SearchableDevice {
  return { id, ip, mac: '', hostname: '', status: 'online', subnet: usersLan, ...extra }
}

const devices: SearchableDevice[] = [
  device(1, '192.168.1.10', { hostname: 'pc-alice', mac: 'AA:BB:CC:00:11:22' }),
  device(2, '192.168.1.20', { hostname: 'printer-2F', mac: 'aa:bb:cc:00:11:33' }),
  device(3, '10.0.0.5', { hostname: 'core-switch', mac: '00-1A-2B-3C-4D-5E', subnet: mgmtLan }),
  device(4, '172.16.5.100', { hostname: 'nas', mac: '0011.2233.4455', subnet: null }),
]

function ips(query: string): string[] {
  return matchDevices(devices, query).map((found) => found.ip)
}

describe('matchDevices', () => {
  it('finds devices by a partial IP', () => {
    expect(ips('192.168.1')).toEqual(['192.168.1.10', '192.168.1.20'])
    expect(ips('.5')).toEqual(['10.0.0.5', '172.16.5.100'])
  })

  it('finds devices by hostname regardless of case', () => {
    expect(ips('PRINTER')).toEqual(['192.168.1.20'])
    expect(ips('2f')).toEqual(['192.168.1.20'])
    expect(ips('  switch ')).toEqual(['10.0.0.5'])
  })

  it('finds devices by MAC written with any separator or case', () => {
    expect(ips('aa-bb-cc')).toEqual(['192.168.1.10', '192.168.1.20'])
    expect(ips('AABBCC001122')).toEqual(['192.168.1.10'])
    expect(ips('aabb.cc00.1133')).toEqual(['192.168.1.20'])
    expect(ips('1a:2b:3c')).toEqual(['10.0.0.5'])
    expect(ips('001a2b3c4d5e')).toEqual(['10.0.0.5'])
    expect(ips('22:33:44')).toEqual(['172.16.5.100'])
  })

  it('does not match MAC digits for a query shaped like an IP', () => {
    expect(ips('11.2')).toEqual([])
    expect(ips('1122')).toEqual(['172.16.5.100', '192.168.1.10'])
  })

  it('ranks exact matches first, then prefixes, then other matches, each by address', () => {
    expect(ips('10')).toEqual(['10.0.0.5', '172.16.5.100', '192.168.1.10'])

    const list = [
      device(10, '192.168.1.110'),
      device(11, '10.1.1.1'),
      device(12, '192.168.1.12', { hostname: 'host-192.168.1.1' }),
      device(13, '192.168.1.1'),
      device(14, '192.168.1.10'),
    ]
    expect(matchDevices(list, '192.168.1.1').map((found) => found.ip)).toEqual([
      '192.168.1.1',
      '192.168.1.10',
      '192.168.1.12',
      '192.168.1.110',
    ])

    const hosts = [device(20, '10.0.0.1', { hostname: 'backup-nas' }), device(21, '10.0.0.9', { hostname: 'NAS-01' })]
    expect(matchDevices(hosts, 'nas').map((found) => found.hostname)).toEqual(['NAS-01', 'backup-nas'])
  })

  it('matches nothing for an empty or blank query', () => {
    expect(ips('')).toEqual([])
    expect(ips('   ')).toEqual([])
  })
})

describe('resultPath', () => {
  it('opens the subnet page with the address selected', () => {
    expect(resultPath(devices[0])).toBe('/subnets/3?ip=192.168.1.10')
    expect(resultPath(devices[2])).toBe('/subnets/1?ip=10.0.0.5')
  })

  it('opens the device list for a device outside every subnet', () => {
    expect(resultPath(devices[3])).toBe('/devices')
  })
})

describe('isTypingTarget', () => {
  it('is true for form fields and editable content', () => {
    expect(isTypingTarget({ tagName: 'INPUT', isContentEditable: false })).toBe(true)
    expect(isTypingTarget({ tagName: 'TEXTAREA', isContentEditable: false })).toBe(true)
    expect(isTypingTarget({ tagName: 'SELECT', isContentEditable: false })).toBe(true)
    expect(isTypingTarget({ tagName: 'DIV', isContentEditable: true })).toBe(true)
  })

  it('is false for buttons, links, the page body or nothing focused', () => {
    expect(isTypingTarget({ tagName: 'BUTTON', isContentEditable: false })).toBe(false)
    expect(isTypingTarget({ tagName: 'A', isContentEditable: false })).toBe(false)
    expect(isTypingTarget({ tagName: 'BODY', isContentEditable: false })).toBe(false)
    expect(isTypingTarget(null)).toBe(false)
  })
})

describe('isSearchShortcut', () => {
  const slash: ShortcutEvent = { key: '/', ctrlKey: false, metaKey: false, altKey: false }
  const body = { tagName: 'BODY', isContentEditable: false }

  it('takes a plain "/" pressed outside any field', () => {
    expect(isSearchShortcut(slash, body)).toBe(true)
    expect(isSearchShortcut(slash, { tagName: 'BUTTON', isContentEditable: false })).toBe(true)
    expect(isSearchShortcut(slash, null)).toBe(true)
  })

  it('leaves "/" alone while another field has focus', () => {
    expect(isSearchShortcut(slash, { tagName: 'INPUT', isContentEditable: false })).toBe(false)
    expect(isSearchShortcut(slash, { tagName: 'TEXTAREA', isContentEditable: false })).toBe(false)
    expect(isSearchShortcut(slash, { tagName: 'DIV', isContentEditable: true })).toBe(false)
  })

  it('ignores other keys, modifier combinations, composition and handled events', () => {
    expect(isSearchShortcut({ ...slash, key: 'a' }, body)).toBe(false)
    expect(isSearchShortcut({ ...slash, ctrlKey: true }, body)).toBe(false)
    expect(isSearchShortcut({ ...slash, metaKey: true }, body)).toBe(false)
    expect(isSearchShortcut({ ...slash, altKey: true }, body)).toBe(false)
    expect(isSearchShortcut({ ...slash, isComposing: true }, body)).toBe(false)
    expect(isSearchShortcut({ ...slash, defaultPrevented: true }, body)).toBe(false)
  })
})

describe('stepIndex', () => {
  it('moves through the results and wraps at both ends', () => {
    expect(stepIndex(0, 1, 3)).toBe(1)
    expect(stepIndex(2, 1, 3)).toBe(0)
    expect(stepIndex(0, -1, 3)).toBe(2)
    expect(stepIndex(1, -1, 3)).toBe(0)
  })

  it('has no active result when there are no results', () => {
    expect(stepIndex(0, 1, 0)).toBe(-1)
    expect(stepIndex(-1, -1, 0)).toBe(-1)
  })

  it('starts from the first or last result when none is active', () => {
    expect(stepIndex(-1, 1, 3)).toBe(0)
    expect(stepIndex(-1, -1, 3)).toBe(2)
  })
})
