import { describe, expect, it } from 'vitest'
import { subnetOccupancy, sumOccupancy } from './occupancy'

describe('subnetOccupancy', () => {
  it('counts devices as Occupied out of the usable addresses', () => {
    expect(subnetOccupancy({ deviceCount: 3, totalHosts: 254 })).toEqual({ occupied: 3, usable: 254, percent: 1 })
  })

  it('rounds the percentage', () => {
    expect(subnetOccupancy({ deviceCount: 2, totalHosts: 4 }).percent).toBe(50)
    expect(subnetOccupancy({ deviceCount: 1, totalHosts: 3 }).percent).toBe(33)
  })

  it('reports 0% for a subnet with no usable addresses and no devices', () => {
    expect(subnetOccupancy({ deviceCount: 0, totalHosts: 0 }).percent).toBe(0)
  })

  it('caps the percentage at 100 when devices outnumber usable addresses', () => {
    expect(subnetOccupancy({ deviceCount: 1, totalHosts: 0 }).percent).toBe(100)
    expect(subnetOccupancy({ deviceCount: 5, totalHosts: 2 }).percent).toBe(100)
  })
})

describe('sumOccupancy', () => {
  it('adds Occupied and usable across subnets and recomputes the percentage', () => {
    expect(
      sumOccupancy([
        { deviceCount: 3, totalHosts: 254 },
        { deviceCount: 2, totalHosts: 2 },
      ]),
    ).toEqual({ occupied: 5, usable: 256, percent: 2 })
  })

  it('is empty for no subnets', () => {
    expect(sumOccupancy([])).toEqual({ occupied: 0, usable: 0, percent: 0 })
  })
})
