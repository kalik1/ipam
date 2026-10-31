export interface Occupancy {
  occupied: number
  usable: number
  percent: number
}

export interface CountedSubnet {
  deviceCount: number
  totalHosts: number
}

function percentOf(occupied: number, usable: number): number {
  if (usable <= 0) return occupied > 0 ? 100 : 0
  return Math.min(100, Math.round((occupied / usable) * 100))
}

export function subnetOccupancy(subnet: CountedSubnet): Occupancy {
  return {
    occupied: subnet.deviceCount,
    usable: subnet.totalHosts,
    percent: percentOf(subnet.deviceCount, subnet.totalHosts),
  }
}

export function sumOccupancy(subnets: CountedSubnet[]): Occupancy {
  const occupied = subnets.reduce((total, subnet) => total + subnet.deviceCount, 0)
  const usable = subnets.reduce((total, subnet) => total + subnet.totalHosts, 0)
  return { occupied, usable, percent: percentOf(occupied, usable) }
}
