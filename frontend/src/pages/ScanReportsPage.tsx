import { useCallback, useEffect, useState } from 'react'
import api, { getErrorMessage } from '@/lib/api'
import { formatTimestamp, timeAgo } from '@/lib/format'
import { useLiveEvent } from '@/lib/live'
import type { ScanReport } from '@/types'
import { Button } from '@/components/Button'
import { EmptyState } from '@/components/EmptyState'
import { Panel, PanelHeader } from '@/components/Panel'
import { Table, TableMessage } from '@/components/Table'
import { PageActions } from '@/components/shell/PageActions'

const COLUMNS = 5

export default function ScanReportsPage() {
  const [reports, setReports] = useState<ScanReport[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await api.get<ScanReport[]>('/scan/reports')
      setReports(data)
      setError('')
    } catch (e) {
      setError(getErrorMessage(e, 'Failed to load scan reports'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  useLiveEvent((event) => {
    if (event.type === 'scan.report' && event.data.source === 'report') void load()
  })

  return (
    <>
      <PageActions>
        <Button onClick={() => void load()} disabled={loading} aria-busy={loading}>
          Refresh
        </Button>
      </PageActions>

      {error && (
        <p className="alert" role="alert">
          {error}
        </p>
      )}

      <Panel aria-label="Scan reports">
        <PanelHeader title="Scan reports">
          <span className="list-count">
            {loading && reports.length === 0 ? 'Loading' : `Latest ${reports.length} ${reports.length === 1 ? 'scan' : 'scans'} reported by agents`}
          </span>
        </PanelHeader>
        <Table>
          <thead>
            <tr>
              <th>Received</th>
              <th>Time</th>
              <th>Agent</th>
              <th>Platform</th>
              <th className="num">Devices seen</th>
            </tr>
          </thead>
          <tbody>
            {loading && reports.length === 0 ? (
              <TableMessage colSpan={COLUMNS}>Loading scan reports...</TableMessage>
            ) : reports.length === 0 ? (
              <TableMessage colSpan={COLUMNS}>
                <EmptyState title="No scans reported" message="Scans appear here when an agent reports the devices it has seen" />
              </TableMessage>
            ) : (
              reports.map((report) => (
                <tr key={report.id}>
                  <td className="text-fg-2">{timeAgo(report.receivedAt)}</td>
                  <td className="mono text-fg-2">{formatTimestamp(report.receivedAt)}</td>
                  <td className="font-semibold">{report.agent}</td>
                  <td className="text-fg-2">{report.platform || <span className="cell-muted">Not reported</span>}</td>
                  <td className="num mono">{report.deviceCount}</td>
                </tr>
              ))
            )}
          </tbody>
        </Table>
      </Panel>
    </>
  )
}
