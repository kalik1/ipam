import { createPortal } from 'react-dom'
import { memo, useCallback, useMemo, useState, type MouseEvent } from 'react'
import { ipToNumber, numberToIp, parseCidr } from '@/lib/ip'
import { timeAgo } from '@/lib/format'
import { Badge } from '@/components/Badge'
import type { DhcpPool, Device } from '@/types'

const MAX_CELLS = 4096

interface IpGridProps {
  cidr: string
  includeFirstLast: boolean
  gateways: string[]
  dhcpPools: DhcpPool[]
  devices: Device[]
}

interface Cell {
  ip: string
  label: string
  color: string
  dimmed: boolean
  device?: Device
}

interface Hover {
  cell: Cell
  x: number
  y: number
}

const LEGEND = [
  { label: 'Online', color: 'bg-emerald-500' },
  { label: 'Offline', color: 'bg-rose-500' },
  { label: 'Gateway', color: 'bg-amber-400' },
  { label: 'DHCP', color: 'bg-sky-500' },
  { label: 'Reserved', color: 'bg-zinc-800 opacity-50' },
  { label: 'Free', color: 'bg-slate-700' },
]

export function IpGrid({ cidr, includeFirstLast, gateways, dhcpPools, devices }: IpGridProps) {
  const { network, size } = parseCidr(cidr)
  const tooLarge = size > MAX_CELLS

  const usedCount = useMemo(
    () => devices.filter((d) => d.ip).length,
    [devices],
  )

  const cells = useMemo<Cell[]>(() => {
    if (tooLarge) return []
    const gatewaySet = new Set(gateways.map((ip) => ipToNumber(ip)))
    const deviceByIp = new Map<number, Device>()
    for (const device of devices) {
      deviceByIp.set(ipToNumber(device.ip), device)
    }
    const ranges = dhcpPools.map((pool) => ({
      start: ipToNumber(pool.startIp),
      end: ipToNumber(pool.endIp),
    }))
    const first = network
    const last = network + size - 1
    const result: Cell[] = []
    for (let i = 0; i < size; i++) {
      const value = network + i
      const ip = numberToIp(value)
      const device = deviceByIp.get(value)
      let label = 'free'
      let color = 'bg-slate-700'
      let dimmed = false
      if (device) {
        label = device.status === 'online' ? 'online device' : 'offline device'
        color = device.status === 'online' ? 'bg-emerald-500' : 'bg-rose-500'
      } else if (gatewaySet.has(value)) {
        label = 'gateway'
        color = 'bg-amber-400'
      } else if (ranges.some((range) => value >= range.start && value <= range.end)) {
        label = 'DHCP pool'
        color = 'bg-sky-500'
      } else if (!includeFirstLast && (value === first || value === last)) {
        label = value === first ? 'network' : 'broadcast'
        color = 'bg-zinc-800'
        dimmed = true
      }
      result.push({ ip, label, color, dimmed, device })
    }
    return result
  }, [cidr, includeFirstLast, gateways, dhcpPools, devices, network, size, tooLarge])

  const [hover, setHover] = useState<Hover | null>(null)
  const handleEnter = useCallback(
    (event: MouseEvent<HTMLDivElement>, cell: Cell) => {
      const rect = event.currentTarget.getBoundingClientRect()
      setHover({ cell, x: rect.left + rect.width / 2, y: rect.top })
    },
    [],
  )
  const handleLeave = useCallback(() => setHover(null), [])

  if (tooLarge) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-slate-400">Subnet troppo grande per la griglia completa</p>
        <div className="flex flex-wrap gap-2">
          <StatChip label="Total" value={size} />
          <StatChip label="Used" value={usedCount} />
          <StatChip label="Gateways" value={gateways.length} />
          <StatChip label="DHCP pools" value={dhcpPools.length} />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <CellGrid cells={cells} onEnter={handleEnter} onLeave={handleLeave} />
      {hover && createPortal(<CellTooltip hover={hover} />, document.body)}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        {LEGEND.map((item) => (
          <span key={item.label} className="flex items-center gap-1.5 text-xs text-slate-400">
            <span className={`h-2.5 w-2.5 rounded-[2px] ${item.color}`} />
            {item.label}
          </span>
        ))}
      </div>
    </div>
  )
}

const CellGrid = memo(function CellGrid({
  cells,
  onEnter,
  onLeave,
}: {
  cells: Cell[]
  onEnter: (event: MouseEvent<HTMLDivElement>, cell: Cell) => void
  onLeave: () => void
}) {
  return (
    <div
      className="grid gap-[3px]"
      style={{ gridTemplateColumns: 'repeat(32, minmax(14px, 1fr))' }}
    >
      {cells.map((cell) => (
        <div
          key={cell.ip}
          onMouseEnter={(event) => onEnter(event, cell)}
          onMouseLeave={onLeave}
          aria-label={`${cell.ip} ${cell.label}`}
          className={`h-3.5 rounded-[2px] ${cell.color} ${cell.dimmed ? 'opacity-50' : ''}`}
        />
      ))}
    </div>
  )
})

function CellTooltip({ hover }: { hover: Hover }) {
  const { cell, x, y } = hover
  const device = cell.device
  const showBelow = y < 160
  return (
    <div
      role="tooltip"
      className="pointer-events-none fixed z-50"
      style={{
        left: x,
        top: showBelow ? y + 12 : y - 12,
        transform: `translateX(-50%)${showBelow ? '' : ' translateY(-100%)'}`,
      }}
    >
      <div className="w-64 rounded-lg border border-slate-700/70 bg-slate-900/95 p-3 text-xs shadow-lg shadow-black/40 ring-1 ring-black/20 backdrop-blur-sm">
        {device ? (
          <div className="space-y-2.5">
            <div className="flex items-center justify-between gap-3">
              <span className="font-mono text-sm font-semibold text-indigo-400">{cell.ip}</span>
              <Badge status={device.status} />
            </div>
            {device.hostname && (
              <p className="font-medium text-slate-100">{device.hostname}</p>
            )}
            <dl className="space-y-1">
              <TipRow label="MAC" value={device.mac || '—'} mono />
              <TipRow label="Vendor" value={device.vendor || '—'} />
              <TipRow label="Last seen" value={timeAgo(device.lastSeen)} />
            </dl>
            {device.notes && (
              <p className="border-t border-slate-700/60 pt-1.5 text-slate-400">{device.notes}</p>
            )}
          </div>
        ) : (
          <div className="flex items-center justify-between gap-3">
            <span className="font-mono text-sm font-semibold text-indigo-400">{cell.ip}</span>
            <span className="text-slate-400 capitalize">{cell.label}</span>
          </div>
        )}
      </div>
    </div>
  )
}

function TipRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-slate-500">{label}</dt>
      <dd className={`text-slate-200 ${mono ? 'font-mono text-[11px]' : ''}`}>{value}</dd>
    </div>
  )
}

function StatChip({ label, value }: { label: string; value: number }) {
  return (
    <span className="rounded-md bg-slate-800 px-2.5 py-1 text-xs text-slate-300 ring-1 ring-inset ring-slate-700">
      {label} <span className="font-semibold text-slate-100 tabular-nums">{value}</span>
    </span>
  )
}