import { describe, expect, it } from 'vitest'
import { vlanColor } from './vlan'

describe('vlanColor', () => {
  it('gives the seeded VLANs 10, 20 and 30 green, orange and pink cables', () => {
    expect(vlanColor(10)).toBe('#2FB874')
    expect(vlanColor(20)).toBe('#EE8A2E')
    expect(vlanColor(30)).toBe('#E5679F')
  })

  it('repeats the palette every 8 VLAN IDs', () => {
    expect(vlanColor(8)).toBe('#3D7EF0')
    expect(vlanColor(15)).toBe('#DCE1E6')
    expect(vlanColor(4094)).toBe('#E5679F')
  })

  it('draws a gray cable when there is no VLAN', () => {
    expect(vlanColor(null)).toBe('#7A8591')
    expect(vlanColor(undefined)).toBe('#7A8591')
  })
})
