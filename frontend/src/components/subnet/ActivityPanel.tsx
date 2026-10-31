import { formatClock } from '@/lib/format'
import type { ActivityEntry, ActivityKind } from '@/lib/subnetLive'
import { Panel } from '@/components/Panel'

const KIND_LABEL: Record<ActivityKind, string> = { scan: 'Scan', new: 'New', offline: 'Offline' }

function EntryBody({ entry }: { entry: ActivityEntry }) {
  return (
    <>
      <span className="t">{formatClock(entry.at)}</span>
      <span className="kind">{KIND_LABEL[entry.kind]}</span>
      <span className="txt">
        <b>{entry.who}</b> {entry.what}
      </span>
    </>
  )
}

export function ActivityPanel({ entries, onSelect }: { entries: ActivityEntry[]; onSelect: (ip: string) => void }) {
  return (
    <Panel className="feed" aria-label="Activity in this subnet">
      <div className="panel-head">
        <h2 className="panel-title">Activity</h2>
        <span className="r">Today, newest first</span>
      </div>
      {entries.length === 0 ? (
        <p className="feed-empty">No scans, new devices or offline devices today.</p>
      ) : (
        <ul className="feedlist">
          {entries.map((entry) => {
            const ip = entry.ip
            return (
              <li key={entry.key}>
                {ip ? (
                  <button type="button" className={`ev ${entry.kind}`} onClick={() => onSelect(ip)}>
                    <EntryBody entry={entry} />
                  </button>
                ) : (
                  <div className={`ev ${entry.kind}`}>
                    <EntryBody entry={entry} />
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </Panel>
  )
}
