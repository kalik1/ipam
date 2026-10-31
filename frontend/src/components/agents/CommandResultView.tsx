import { RESULT_TIMEOUT_MS, formatValue, isRecord, resultSections, type ResultRow } from '@/lib/commandResult'
import { plural, timeAgo } from '@/lib/format'
import type { CommandRun } from '@/lib/useCommandRun'
import type { AgentResult } from '@/types'
import { Button } from '@/components/Button'
import { StatusLed } from '@/components/StatusLed'
import { Table } from '@/components/Table'

interface Column {
  label: string
  value: (row: ResultRow) => unknown
  mono?: boolean
}

function field(key: string, label: string, mono = false): Column {
  return { label, value: (row) => row[key], mono }
}

function Cell({ value, mono }: { value: unknown; mono?: boolean }) {
  const text = formatValue(value)
  if (text === null) return <td className="cell-muted">None</td>
  return <td className={mono ? 'mono' : undefined}>{text}</td>
}

function ResultTable({ title, columns, rows }: { title: string; columns: Column[]; rows: ResultRow[] }) {
  return (
    <div className="result-block">
      <h4 className="result-title">{title}</h4>
      <Table>
        {columns.some((column) => column.label) && (
          <thead>
            <tr>
              {columns.map((column, index) => (
                <th key={index}>{column.label}</th>
              ))}
            </tr>
          </thead>
        )}
        <tbody>
          {rows.map((row, index) => (
            <tr key={index}>
              {columns.map((column, col) => (
                <Cell key={col} value={column.value(row)} mono={column.mono} />
              ))}
            </tr>
          ))}
        </tbody>
      </Table>
    </div>
  )
}

function MetaEntry({ name, value }: { name: string; value: unknown }) {
  if (Array.isArray(value) && value.length > 0 && value.every(isRecord)) {
    const keys = Array.from(new Set(value.flatMap((row) => Object.keys(row))))
    return <ResultTable title={name} columns={keys.map((key) => field(key, key))} rows={value} />
  }
  if (isRecord(value)) {
    const rows = Object.entries(value).map(([key, entry]) => ({ key, entry }))
    return <ResultTable title={name} columns={[field('key', ''), field('entry', '')]} rows={rows} />
  }
  return (
    <div className="result-block">
      <h4 className="result-title">{name}</h4>
      <p className="panel-body m-0">{formatValue(value) ?? 'None'}</p>
    </div>
  )
}

export function CommandResultView({ result, onDismiss }: { result: AgentResult; onDismiss?: () => void }) {
  const sections = resultSections(result.data)
  return (
    <div className="result">
      <div className="result-head">
        <span className="status">
          <StatusLed state={result.ok ? 'on' : 'error'} />
          {result.ok ? 'Result received' : 'Command failed'}
          <span className="cell-muted">{timeAgo(result.receivedAt)}</span>
        </span>
        {onDismiss && (
          <Button variant="ghost" onClick={onDismiss}>
            Dismiss
          </Button>
        )}
      </div>
      {!result.ok ? (
        <p className="alert" role="alert">
          {result.error ?? 'Unknown error'}
        </p>
      ) : sections.empty ? (
        <p className="disc-note">The connector returned no data.</p>
      ) : (
        <>
          {sections.devices.length > 0 && (
            <ResultTable
              title={plural(sections.devices.length, 'device seen', 'devices seen')}
              rows={sections.devices}
              columns={[
                field('ip', 'IP address', true),
                field('mac', 'MAC address', true),
                field('hostname', 'Hostname'),
                field('vendor', 'Vendor'),
              ]}
            />
          )}
          {sections.subnets.length > 0 && (
            <ResultTable
              title={plural(sections.subnets.length, 'subnet', 'subnets')}
              rows={sections.subnets}
              columns={[
                field('cidr', 'CIDR', true),
                field('name', 'Name'),
                field('gateway', 'Gateway', true),
                { label: 'VLAN', value: (row) => sections.vlanName(row.vlanId) },
              ]}
            />
          )}
          {sections.vlans.length > 0 && (
            <ResultTable
              title={plural(sections.vlans.length, 'VLAN', 'VLANs')}
              rows={sections.vlans}
              columns={[field('vlanId', 'VLAN ID', true), field('name', 'Name')]}
            />
          )}
          {sections.meta &&
            Object.entries(sections.meta).map(([name, value]) => <MetaEntry key={name} name={name} value={value} />)}
        </>
      )}
    </div>
  )
}

export function RunFeedback({ run, onDismiss }: { run: CommandRun; onDismiss: () => void }) {
  switch (run.status) {
    case 'idle':
      return null
    case 'sending':
      return (
        <span className="run-note" role="status">
          <StatusLed state="pending" />
          Sending command
        </span>
      )
    case 'waiting':
      return (
        <span className="run-note" role="status">
          <StatusLed state="pending" />
          Command sent, waiting for the result from the agent
        </span>
      )
    case 'timeout':
      return (
        <span className="run-note warn" role="status">
          No result received within {RESULT_TIMEOUT_MS / 1000} seconds
          <Button variant="ghost" className="ml-2" onClick={onDismiss}>
            Dismiss
          </Button>
        </span>
      )
    case 'error':
      return (
        <span className="run-note err" role="alert">
          {run.message}
          <Button variant="ghost" className="ml-2" onClick={onDismiss}>
            Dismiss
          </Button>
        </span>
      )
    case 'done':
      return <CommandResultView result={run.result} onDismiss={onDismiss} />
  }
}
