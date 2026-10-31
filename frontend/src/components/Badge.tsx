import type { Device } from '@/types'
import { StatusLed } from './StatusLed'

export function Badge({ status }: { status: Device['status'] }) {
  const online = status === 'online'
  return (
    <span className="status">
      <StatusLed state={online ? 'on' : 'off'} />
      {online ? 'Online' : 'Offline'}
    </span>
  )
}
