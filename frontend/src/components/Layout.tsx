import { useMemo, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '@/lib/auth'
import { breadcrumbs, type CrumbNames } from '@/lib/nav'
import { vlanLabel } from '@/lib/vlan'
import { PageActionsSlot } from './shell/PageActions'
import { Rail } from './shell/Rail'
import { TopBar } from './shell/TopBar'
import { useShellData } from './shell/useShellData'

export function Layout() {
  const { user, logout } = useAuth()
  const { pathname } = useLocation()
  const data = useShellData(pathname)
  const [actionsSlot, setActionsSlot] = useState<HTMLElement | null>(null)

  const names = useMemo<CrumbNames>(
    () => ({
      vlans: Object.fromEntries(data.vlans.map((vlan) => [vlan.id, vlanLabel(vlan)])),
      subnets: Object.fromEntries(data.subnets.map((subnet) => [subnet.id, subnet.name])),
    }),
    [data.vlans, data.subnets],
  )

  return (
    <div className="shell">
      <a
        href="#content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:bg-panel focus:px-3 focus:py-2"
      >
        Skip to content
      </a>
      <Rail data={data} username={user?.username} onLogout={logout} />
      <div className="main">
        <TopBar crumbs={breadcrumbs(pathname, names)} actionsRef={setActionsSlot} />
        <main id="content" className="content focus:outline-none" tabIndex={-1}>
          <PageActionsSlot.Provider value={actionsSlot}>
            <Outlet />
          </PageActionsSlot.Provider>
        </main>
      </div>
    </div>
  )
}
