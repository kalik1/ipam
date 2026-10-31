import type { Occupancy } from '@/lib/occupancy'

export function OccupancyMeter({ occupancy, color }: { occupancy: Occupancy; color: string }) {
  const { occupied, usable, percent } = occupancy
  return (
    <span className="occ" title={`${occupied} of ${usable} usable addresses occupied`}>
      <span className="minibar" aria-hidden="true">
        <i style={{ width: `${percent}%`, background: color }} />
      </span>
      <span className="mono">{occupied}</span>
      <span className="mono pc">{percent}%</span>
    </span>
  )
}
