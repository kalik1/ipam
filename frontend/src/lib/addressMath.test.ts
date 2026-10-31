import { describe, expect, it } from 'vitest'
import { addressMath, addressPosition, formatRange, splitIp, splitMac, subnetFacts } from './addressMath'

describe('subnetFacts', () => {
  it('derives netmask, wildcard, network, broadcast, usable range, reverse zone and size of a /24', () => {
    expect(subnetFacts('10.0.20.0/24', false)).toEqual({
      network: '10.0.20.0',
      broadcast: '10.0.20.255',
      netmask: '255.255.255.0',
      wildcard: '0.0.0.255',
      firstUsable: '10.0.20.1',
      lastUsable: '10.0.20.254',
      usable: 254,
      reverseZone: '20.0.10.in-addr.arpa',
      size: 256,
    })
  })

  it('counts network and broadcast as usable when the subnet includes them', () => {
    expect(subnetFacts('10.0.1.0/30', true)).toMatchObject({ firstUsable: '10.0.1.0', lastUsable: '10.0.1.3', usable: 4, netmask: '255.255.255.252' })
  })

  it('has no usable range for a /31 or /32 that does not include first and last', () => {
    expect(subnetFacts('10.0.1.0/31', false)).toMatchObject({ firstUsable: null, lastUsable: null, usable: 0 })
    expect(subnetFacts('10.0.1.9/32', false)).toMatchObject({ firstUsable: null, lastUsable: null, usable: 0, size: 1 })
  })

  it.each([
    ['172.16.0.0/16', '16.172.in-addr.arpa'],
    ['10.0.0.0/8', '10.in-addr.arpa'],
    ['172.16.4.0/22', '4-7.16.172.in-addr.arpa'],
    ['10.0.1.0/30', '1.0.10.in-addr.arpa'],
    ['10.128.0.0/9', '128-255.10.in-addr.arpa'],
  ])('names the reverse zone of %s as %s', (cidr, zone) => {
    expect(subnetFacts(cidr, false).reverseZone).toBe(zone)
  })
})

describe('addressMath', () => {
  it('splits the binary form at the prefix and gives hex, decimal, PTR name and address number', () => {
    expect(addressMath('10.0.20.20', '10.0.20.0/24', false)).toEqual({
      networkBits: '00001010.00000000.00010100.',
      hostBits: '00010100',
      hex: '0x0A001414',
      decimal: '167777300',
      ptr: '20.20.0.10.in-addr.arpa',
      addressNumber: 20,
      usable: 254,
    })
  })

  it('splits the binary form inside an octet for a /22', () => {
    expect(addressMath('172.16.5.10', '172.16.4.0/22', false)).toMatchObject({
      networkBits: '10101100.00010000.000001',
      hostBits: '01.00001010',
      addressNumber: 266,
      usable: 1022,
    })
  })

  it('numbers addresses from the network address when the subnet includes it', () => {
    expect(addressMath('10.0.1.0', '10.0.1.0/30', true)).toMatchObject({ addressNumber: 1, usable: 4 })
  })

  it('gives no address number to the network and broadcast addresses', () => {
    expect(addressMath('10.0.20.0', '10.0.20.0/24', false).addressNumber).toBeNull()
    expect(addressMath('10.0.20.255', '10.0.20.0/24', false).addressNumber).toBeNull()
  })
})

describe('addressPosition', () => {
  it('places an address among the usable addresses of its subnet', () => {
    expect(addressPosition(addressMath('10.0.20.20', '10.0.20.0/24', false))).toBe('Address 20 of 254')
    expect(addressPosition(addressMath('172.16.5.10', '172.16.0.0/16', false))).toBe('Address 1,290 of 65,534')
  })

  it('says the network and broadcast addresses are not usable', () => {
    expect(addressPosition(addressMath('10.0.20.255', '10.0.20.0/24', false))).toBe('Not usable')
  })
})

describe('formatRange', () => {
  it('shortens the end of a range that stays in the same /24', () => {
    expect(formatRange('10.0.20.100', '10.0.20.199')).toBe('10.0.20.100 to .199')
  })

  it('writes both ends in full when the range crosses a /24', () => {
    expect(formatRange('172.16.0.1', '172.16.255.254')).toBe('172.16.0.1 to 172.16.255.254')
  })
})

describe('splitIp', () => {
  it('separates the octets that belong to the network from the rest', () => {
    expect(splitIp('10.0.20.20', 24)).toEqual({ network: '10.0.20.', host: '20' })
    expect(splitIp('10.0.20.130', 25)).toEqual({ network: '10.0.20.', host: '130' })
    expect(splitIp('172.16.5.10', 22)).toEqual({ network: '172.16.', host: '5.10' })
  })

  it('always keeps the last octet in the distinguishing part', () => {
    expect(splitIp('10.0.20.9', 32)).toEqual({ network: '10.0.20.', host: '9' })
  })
})

describe('splitMac', () => {
  it('sets the vendor part (OUI) of a MAC apart from the device part', () => {
    expect(splitMac('48:8F:5A:3C:01:A2')).toEqual({ oui: '48:8F:5A:', nic: '3C:01:A2' })
    expect(splitMac('48-8f-5a-3c-01-a2')).toEqual({ oui: '48-8f-5a-', nic: '3c-01-a2' })
    expect(splitMac('488f.5a3c.01a2')).toEqual({ oui: '488f.5a', nic: '3c.01a2' })
    expect(splitMac('488F5A3C01A2')).toEqual({ oui: '488F5A', nic: '3C01A2' })
  })

  it('leaves anything that is not a MAC whole', () => {
    expect(splitMac('')).toEqual({ oui: '', nic: '' })
    expect(splitMac('unknown')).toEqual({ oui: '', nic: 'unknown' })
  })
})
