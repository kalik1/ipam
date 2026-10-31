import { useMemo } from 'react'
import { NavLink } from 'react-router-dom'
import { useLive } from '@/lib/live'
import { blinkClass, brandLedClass, type LinkStatus, type LiveState } from '@/lib/liveState'
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

const LINK_LABEL: Record<LinkStatus, string> = {
  connecting: 'Connecting to live updates',
  open: 'Live updates connected',
  down: 'Live updates disconnected',
}

function AgentList({ live }: { live: LiveState }) {
  return (
    <>
      <div className="navhead">Agents</div>
      {live.agentsLoaded && live.agents.length === 0 && <p className="px-2 text-[12px] text-fg-3">No agents connected</p>}
      {live.agents.map((agent) => (
        <div className="agent" key={agent.name}>
          <StatusLed
            state={agent.connected ? 'on' : 'error'}
            label={agent.connected ? 'Connected' : 'Disconnected'}
            className={blinkClass(agent.heartbeats, 'hb')}
          />
          <span className="truncate">{agent.name}</span>
          <span className="pf">{agent.platform}</span>
        </div>
      ))}
    </>
  )
}

export function Rail({ data, username, onLogout }: { data: ShellData; username?: string; onLogout: () => void }) {
  const live = useLive()
  const groups = useMemo(() => groupSubnetsByVlan(data.subnets), [data.subnets])
  const connectedAgents = live.agents.filter((agent) => agent.connected).length
  const counts = { ...data.counts, agents: live.agentsLoaded ? connectedAgents : undefined }
  return (
    <aside className="rail">
      <span className="railvent" aria-hidden="true" />
      <div className="brand" title={LINK_LABEL[live.link]}>
        <BrandMark ledClassName={brandLedClass(live)} />
        <div>
          <b>IPAM</b>
          <span>Network address manager</span>
          <span className="sr-only" role="status">
            {LINK_LABEL[live.link]}
          </span>
        </div>
      </div>
      <MainNav counts={counts} />
      <SubnetIndex groups={groups} />
      <div className="railfoot">
        <AgentList live={live} />
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
