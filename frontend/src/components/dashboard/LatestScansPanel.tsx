import { Link } from 'react-router-dom'
import type { ScanEntry } from '@/lib/dashboard'
import { formatTimestamp, timeAgo } from '@/lib/format'
import { Panel } from '@/components/Panel'
import { Table, TableMessage } from '@/components/Table'
import { Tooltip } from '@/components/Tooltip'

const COLUMNS = 4

export function LatestScansPanel({ entries, failed }: { entries: ScanEntry[] | null; failed: boolean }) {
  return (
    <Panel className="box" aria-label="Latest scan reports">
      <div className="boxhead">
        <h2 className="panel-title">Latest scan reports</h2>
        <Link className="r" to="/scan-reports">
          View all
        </Link>
      </div>
      <Table>
        <thead>
          <tr>
            <th>Received</th>
            <th>Agent</th>
            <th>Platform</th>
            <th className="num">Devices seen</th>
          </tr>
        </thead>
        <tbody>
          {entries === null ? (
            <TableMessage colSpan={COLUMNS}>{failed ? 'Could not load the scan reports' : 'Loading scan reports...'}</TableMessage>
          ) : entries.length === 0 ? (
            <TableMessage colSpan={COLUMNS}>No scans reported yet</TableMessage>
          ) : (
            entries.map((entry) => (
              <tr key={entry.key}>
                <Tooltip tip={formatTimestamp(entry.receivedAt)} focusable>
                  <td className="text-fg-2">{timeAgo(entry.receivedAt)}</td>
                </Tooltip>
                <td>
                  <span className="scan-agent">
                    {entry.agent}
                    {entry.source === 'connector' && <span className="tag">connector</span>}
                  </span>
                </td>
                <td className="text-fg-2">{entry.platform || <span className="cell-muted">Not reported</span>}</td>
                <td className="num mono">{entry.devices}</td>
              </tr>
            ))
          )}
        </tbody>
      </Table>
    </Panel>
  )
}
