import type { Device } from '@/types'

export type StatusFilter = 'all' | Device['status']

type WithStatus = Pick<Device, 'status'>

export function statusCounts(devices: WithStatus[]): Record<StatusFilter, number> {
  const online = devices.filter((device) => device.status === 'online').length
  return { all: devices.length, online, offline: devices.length - online }
}

export function filterByStatus<T extends WithStatus>(devices: T[], status: StatusFilter): T[] {
  return status === 'all' ? devices : devices.filter((device) => device.status === status)
}
