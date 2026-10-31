import type { AddressCounters } from '@/lib/addressMap'

interface Segment {
  key: string
  className: string
  count: number
  color?: string
}

function occupiedSegments(counters: AddressCounters, cable: string | undefined): Segment[] {
  if (!cable) return [{ key: 'occ', className: 'seg occ', count: counters.occupied }]
  return [
    { key: 'on', className: 'seg on', count: counters.occupiedOnline, color: cable },
    { key: 'off', className: 'seg off', count: counters.occupiedOffline, color: cable },
  ]
}

function occupiedLabel(counters: AddressCounters, cable: string | undefined): string {
  if (!cable) return `${counters.occupied} occupied`
  return `${counters.occupiedOnline} occupied online, ${counters.occupiedOffline} occupied offline`
}

export function AllocationSegments({ counters, cable }: { counters: AddressCounters; cable?: string }) {
  const segments: Segment[] = [
    ...occupiedSegments(counters, cable),
    { key: 'res', className: 'seg res', count: counters.reserved },
    { key: 'free', className: 'seg free', count: counters.free },
  ]
  const label = `${occupiedLabel(counters, cable)}, ${counters.reserved} reserved, ${counters.free} free of ${counters.usable} usable addresses`
  return (
    <div className="allocbar" role="img" aria-label={label}>
      {segments
        .filter((segment) => segment.count > 0)
        .map((segment) => (
          <span key={segment.key} className={segment.className} style={{ flexGrow: segment.count, backgroundColor: segment.color }} />
        ))}
    </div>
  )
}

export function AllocationBar({ counters, cable }: { counters: AddressCounters; cable: string }) {
  return (
    <>
      <AllocationSegments counters={counters} cable={cable} />
      <div className="legend">
        <span className="lg">
          <span className="sw" style={{ backgroundColor: cable }} />
          Occupied, online <b>{counters.occupiedOnline}</b>
        </span>
        <span className="lg">
          <span className="sw off" style={{ backgroundColor: cable }} />
          Occupied, offline <b>{counters.occupiedOffline}</b>
        </span>
        <span className="lg">
          <span className="sw res" />
          Reserved <b>{counters.reserved}</b>
        </span>
        <span className="lg">
          <span className="sw" />
          Free <b>{counters.free}</b>
        </span>
        <span className="lg total">
          Usable addresses <b>{counters.usable}</b>
        </span>
      </div>
    </>
  )
}
