import { occupancyText, type Occupancy } from '@/lib/occupancy'

function share(count: number, usable: number): string {
  return `${usable > 0 ? (count / usable) * 100 : 0}%`
}

export function OccupancyBar({ occupancy, color }: { occupancy: Occupancy; color: string }) {
  return (
    <span className="minibar" aria-hidden="true">
      <i style={{ width: share(occupancy.occupied, occupancy.usable), background: color }} />
      <i className="res" style={{ width: share(occupancy.reserved, occupancy.usable) }} />
    </span>
  )
}

export function OccupancyMeter({ occupancy, color }: { occupancy: Occupancy; color: string }) {
  return (
    <span className="occ" title={occupancyText(occupancy)}>
      <OccupancyBar occupancy={occupancy} color={color} />
      <span className="mono">{occupancy.occupied}</span>
    </span>
  )
}

export const OCCUPANCY_COLUMNS = 4

export function OccupancyHeads() {
  return (
    <>
      <th className="num">Occupied</th>
      <th className="num">Reserved</th>
      <th className="num">Free</th>
      <th className="num">Usable</th>
    </>
  )
}

export function OccupancyCells({ occupancy, color }: { occupancy: Occupancy; color: string }) {
  return (
    <>
      <td className="num">
        <OccupancyMeter occupancy={occupancy} color={color} />
      </td>
      <td className="num mono">{occupancy.reserved}</td>
      <td className="num mono">
        {occupancy.free}
        {occupancy.usable > 0 && <span className="occ-pc">{occupancy.freePercent}%</span>}
      </td>
      <td className="num mono">{occupancy.usable}</td>
    </>
  )
}
