import { NavLink } from 'react-router-dom'
import { occupancyText } from '@/lib/occupancy'
import type { VlanCableGroup } from '@/lib/subnetIndex'
import { OccupancyBar } from '@/components/OccupancyMeter'
import { Tooltip } from '@/components/Tooltip'

export function SubnetIndex({ groups }: { groups: VlanCableGroup[] }) {
  return (
    <nav className="rackidx" aria-label="Subnets by VLAN">
      <div className="navhead">Subnets by VLAN</div>
      {groups.length === 0 && <p className="px-2 text-[12px] text-fg-3">No subnets yet</p>}
      {groups.map((group) => (
        <div className="vgroup" key={group.tag ?? 'none'}>
          <span className="trunk" style={{ background: group.color }} aria-hidden="true" />
          <div className="vhead">
            <span className="cable" style={{ background: group.color }} aria-hidden="true" />
            {group.label}
          </div>
          {group.subnets.map((subnet) => (
            <Tooltip key={subnet.id} tip={occupancyText(subnet.occupancy)}>
              <NavLink to={`/subnets/${subnet.id}`} className="snet">
                <span className="branch" style={{ background: group.color }} aria-hidden="true" />
                <span className="nm">{subnet.name}</span>
                <span className="pc mono">{subnet.occupancy.allocatedPercent}%</span>
                <span className="cidr mono">{subnet.cidr}</span>
                <OccupancyBar occupancy={subnet.occupancy} color={group.color} />
              </NavLink>
            </Tooltip>
          ))}
        </div>
      ))}
    </nav>
  )
}
