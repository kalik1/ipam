import { useMemo } from 'react'
import { NavLink } from 'react-router-dom'
import { NAV_GROUPS } from '@/lib/nav'
import { groupSubnetsByVlan } from '@/lib/subnetIndex'
import { Button } from '@/components/Button'
import { StatusLed } from '@/components/StatusLed'
import { BrandMark, NavIcon } from '@/components/icons'
import { SubnetIndex } from './SubnetIndex'
import type { ShellData } from './useShellData'

function MainNav({ counts }: { counts: ShellData['counts'] }) {
  return (
    <nav className="rail-nav" aria-label="Main">
      {NAV_GROUPS.map((group) => (
        <div className="navgroup" key={group.label ?? 'home'}>
          {group.label && <div className="navhead">{group.label}</div>}
          {group.items.map((item) => {
            const count = item.countKey ? counts[item.countKey] : undefined
            return (
              <NavLink key={item.to} to={item.to} end={item.to === '/'} className="navi">
                <NavIcon name={item.icon} />
                {item.label}
                {count !== undefined && <span className="count mono">{count}</span>}
              </NavLink>
            )
          })}
        </div>
      ))}
    </nav>
  )
}

function AgentList({ data }: { data: ShellData }) {
  return (
    <>
      <div className="navhead">Agents connected</div>
      {data.agentsLoaded && data.agents.length === 0 && <p className="px-2 text-[12px] text-fg-3">No agents connected</p>}
      {data.agents.map((agent) => (
        <div className="agent" key={agent.name}>
          <StatusLed state="on" label="Connected" />
          <span className="truncate">{agent.name}</span>
          <span className="pf">{agent.platform}</span>
        </div>
      ))}
    </>
  )
}

export function Rail({ data, username, onLogout }: { data: ShellData; username?: string; onLogout: () => void }) {
  const groups = useMemo(() => groupSubnetsByVlan(data.subnets), [data.subnets])
  return (
    <aside className="rail">
      <span className="railvent" aria-hidden="true" />
      <div className="brand">
        <BrandMark ledClassName="brand-led" />
        <div>
          <b>IPAM</b>
          <span>Network address manager</span>
        </div>
      </div>
      <MainNav counts={data.counts} />
      <SubnetIndex groups={groups} />
      <div className="railfoot">
        <AgentList data={data} />
        <div className="user">
          <span className="avatar" aria-hidden="true">
            {(username ?? '?').slice(0, 1)}
          </span>
          <span className="min-w-0 flex-1 truncate">{username ?? 'Signed in'}</span>
          <Button variant="ghost" onClick={onLogout}>
            Log out
          </Button>
        </div>
      </div>
    </aside>
  )
}
