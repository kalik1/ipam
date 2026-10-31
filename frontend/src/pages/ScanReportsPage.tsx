import { useCallback, useEffect, useState } from 'react'
import api, { getErrorMessage } from '@/lib/api'
import { timeAgo } from '@/lib/format'
import type { ScanReport } from '@/types'
import { EmptyState } from '@/components/EmptyState'

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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm text-slate-400">Reports submitted by agents</p>
        <button onClick={() => void load()} className="btn btn-secondary">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden="true">
            <path d="M21 12a9 9 0 1 1-2.64-6.36M21 3v6h-6" />
          </svg>
          Refresh
        </button>
      </div>

      {error && (
        <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">{error}</p>
      )}

      <div className="card overflow-hidden">
        <table className="w-full text-left">
          <thead className="border-b border-slate-800">
            <tr>
              <th className="th">Agent</th>
              <th className="th">Platform</th>
              <th className="th text-right">Devices</th>
              <th className="th">Received at</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {loading ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-slate-500">
                  Loading...
                </td>
              </tr>
            ) : reports.length === 0 ? (
              <tr>
                <td colSpan={4}>
                  <EmptyState title="No scan reports" message="Reports submitted by agents will appear here" />
                </td>
              </tr>
            ) : (
              reports.map((report) => (
                <tr key={report.id} className="transition-colors hover:bg-slate-800/40">
                  <td className="td font-medium text-slate-200">{report.agent}</td>
                  <td className="td">{report.platform || '—'}</td>
                  <td className="td text-right tabular-nums">{report.deviceCount}</td>
                  <td className="td">{timeAgo(report.receivedAt)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
