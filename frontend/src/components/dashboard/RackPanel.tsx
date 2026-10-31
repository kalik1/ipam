import { memo, type CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { cx } from '@/lib/cx'
import { sweepClass, type LiveState } from '@/lib/liveState'
import type { RackCell, RackRow } from '@/lib/rack'
import { EmptyState } from '@/components/EmptyState'

const CELL_CLASS: Record<RackCell, string> = { on: 'c on', off: 'c off', res: 'c res', na: 'c na', free: 'c' }

function poolText({ count, size }: RackRow['pools']): string {
  if (count === 0) return 'No DHCP pool'
  if (count === 1) return `DHCP pool of ${size}`
  return `${count} DHCP pools, ${size} addresses`
}

function freeText(row: RackRow): string {
  if (row.counters.usable === 0) return 'No usable addresses'
  if (row.low) return `${row.freePercent}%, running low`
  return `${row.freePercent}% of ${row.counters.usable}`
}

function rowLabel(row: RackRow): string {
  const { occupied, reserved, free } = row.counters
  return `${row.name}, ${row.cidr}, ${occupied} occupied, ${reserved} reserved, ${free} free${row.low ? ', running low' : ''}`
}

const MiniMap = memo(function MiniMap({ cells }: { cells: RackCell[] }) {
  return (
    <span className="mmap" aria-hidden="true">
      {cells.map((cell, index) => (
        <span key={index} className={CELL_CLASS[cell]} />
      ))}
    </span>
  )
})

function Ear({ right = false }: { right?: boolean }) {
  return (
    <span className={cx('ear', right && 'r')} aria-hidden="true">
      <span className="screw" />
      <span className="screw" />
    </span>
  )
}

const RackUnit = memo(function RackUnit({ row, sweep }: { row: RackRow; sweep: string | undefined }) {
  const { occupied, occupiedOnline, reserved, free } = row.counters
  return (
    <Link to={row.href} className="unit" style={{ '--cable': row.color } as CSSProperties} aria-label={rowLabel(row)}>
      <span className={cx('sweep', sweep)} aria-hidden="true" />
      <Ear />
      <span className="uid">
        <span className="uname">
          <span className="cable" aria-hidden="true" />
          {row.name}
        </span>
        <span className="ucidr mono">{row.cidr}</span>
        <span className="uvlan">{row.vlanLabel}</span>
      </span>
      <MiniMap cells={row.cells} />
      <span className="ustats">
        <span>
          <span>Occupied</span>
          <b>{occupied}</b>
          <i>{occupiedOnline} online</i>
        </span>
        <span>
          <span>Reserved</span>
          <b>{reserved}</b>
          <i>{poolText(row.pools)}</i>
        </span>
        <span className={row.low ? 'warn' : undefined}>
          <span>Free</span>
          <b>{free}</b>
          <i>{freeText(row)}</i>
        </span>
      </span>
      <Ear right />
    </Link>
  )
})

interface RackPanelProps {
  rows: RackRow[]
  live: LiveState
  fiberClass: string | undefined
}

export function RackPanel({ rows, live, fiberClass }: RackPanelProps) {
  return (
    <section className={cx('panel rack hud', fiberClass)} aria-label="Subnets">
      <div className="rackhead">
        <h2 className="panel-title">Subnets</h2>
        <span className="vent" aria-hidden="true" />
        <span className="r">One row per subnet, each cell is an address; subnets over 256 addresses group them per cell</span>
      </div>
      {rows.length === 0 ? (
        <EmptyState title="No subnets yet" message="Add a subnet to see it in the rack" />
      ) : (
        <>
          <div className="colhead" aria-hidden="true">
            <span />
            <span>Subnet</span>
            <span>Address map</span>
            <span>Occupied, reserved, free</span>
            <span />
          </div>
          <div className="units">
            {rows.map((row) => (
              <RackUnit key={row.id} row={row} sweep={sweepClass(live, row.id)} />
            ))}
          </div>
        </>
      )}
    </section>
  )
}
