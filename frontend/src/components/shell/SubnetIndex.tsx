import { NavLink } from 'react-router-dom'
import type { VlanCableGroup } from '@/lib/subnetIndex'

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
            <NavLink
              key={subnet.id}
              to={`/subnets/${subnet.id}`}
              className="snet"
              title={`${subnet.percent}% of usable addresses have a device`}
            >
              <span className="branch" style={{ background: group.color }} aria-hidden="true" />
              <span className="nm">{subnet.name}</span>
              <span className="pc mono">{subnet.percent}%</span>
              <span className="cidr mono">{subnet.cidr}</span>
              <span className="minibar" aria-hidden="true">
                <i style={{ width: `${subnet.percent}%`, background: group.color }} />
              </span>
            </NavLink>
          ))}
        </div>
      ))}
    </nav>
  )
}
