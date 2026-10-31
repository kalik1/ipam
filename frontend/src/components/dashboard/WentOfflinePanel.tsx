import { Link } from 'react-router-dom'
import type { OfflineEntry } from '@/lib/dashboard'
import { formatTimestamp, timeAgo } from '@/lib/format'
import { Panel } from '@/components/Panel'
import { StatusLed } from '@/components/StatusLed'
import { Tooltip } from '@/components/Tooltip'

export function WentOfflinePanel({ entries, failed }: { entries: OfflineEntry[] | null; failed: boolean }) {
  return (
    <Panel className="box" aria-label="Went offline">
      <div className="boxhead">
        <h2 className="panel-title">Went offline</h2>
        <span className="r">Most recent first</span>
      </div>
      {entries === null ? (
        <p className="box-note">{failed ? 'Could not load the devices' : 'Loading devices...'}</p>
      ) : entries.length === 0 ? (
        <p className="box-note">Every device was seen in the last 5 minutes</p>
      ) : (
        <ul className="list">
          {entries.map((entry) => (
            <li key={entry.id}>
              <Tooltip tip={`Last seen ${formatTimestamp(entry.lastSeen)}`}>
                <Link to={entry.href} aria-label={`${entry.name}, ${entry.ip}, last seen ${timeAgo(entry.lastSeen)}`}>
                  <StatusLed state="off" />
                  <span className="t">{entry.name}</span>
                  <span className="w">{timeAgo(entry.lastSeen)}</span>
                  <span className="s">
                    <span className="mono">{entry.ip}</span>
                    {entry.color && <span className="cable" style={{ background: entry.color }} aria-hidden="true" />}
                    {entry.subnet ?? 'No subnet'}
                  </span>
                </Link>
              </Tooltip>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  )
}
