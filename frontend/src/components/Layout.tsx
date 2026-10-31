import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '@/lib/auth'

function Icon({ d, className }: { d: string; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className ?? 'h-4 w-4'}
      aria-hidden="true"
    >
      <path d={d} />
    </svg>
  )
}

const ICONS = {
  dashboard: 'M3 3h7v7H3z M14 3h7v7h-7z M14 14h7v7h-7z M3 14h7v7H3z',
  vlans: 'M12 2 2 7l10 5 10-5-10-5z M2 17l10 5 10-5 M2 12l10 5 10-5',
  subnets: 'M2 12h4 M18 12h4 M12 2v4 M12 18v4 M5 5l2.5 2.5 M16.5 16.5 19 19 M19 5l-2.5 2.5 M7.5 16.5 5 19 M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z',
  devices: 'M2 4h20v12H2z M8 20h8 M12 16v4',
  topology: 'M6 3v6a3 3 0 0 0 3 3h6a3 3 0 0 1 3 3v6 M6 3H4 M6 3h2 M18 21h-2 M18 21h2',
  keys: 'M21 2l-2 2m-7.6 7.6a5.5 5.5 0 1 1-7.8 7.8 5.5 5.5 0 0 1 7.8-7.8zm0 0L15.5 7.5m0 0 3 3L23 7l-3-3m-3.5 3.5 2-2',
  scan: 'M12 3v3 M12 18v3 M3 12h3 M18 12h3 M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z',
  agents: 'M9 9h6v6H9z M5 5h14v14H5z M9 2v3 M15 2v3 M9 19v3 M15 19v3 M2 9h3 M2 15h3 M19 9h3 M19 15h3',
  connectors: 'M9 3v4 M15 3v4 M7 7h10v3a5 5 0 0 1-5 5 5 5 0 0 1-5-5V7z M12 15v6',
}

const NAV = [
  { to: '/', label: 'Dashboard', end: true, icon: ICONS.dashboard, title: 'Dashboard' },
  { to: '/vlans', label: 'VLANs', end: false, icon: ICONS.vlans, title: 'VLANs' },
  { to: '/subnets', label: 'Subnets', end: false, icon: ICONS.subnets, title: 'Subnets' },
  { to: '/devices', label: 'Devices', end: false, icon: ICONS.devices, title: 'Devices' },
  { to: '/topology', label: 'Topology', end: false, icon: ICONS.topology, title: 'Topology' },
  { to: '/api-keys', label: 'API Keys', end: false, icon: ICONS.keys, title: 'API Keys' },
  { to: '/scan-reports', label: 'Scan Reports', end: false, icon: ICONS.scan, title: 'Scan Reports' },
  { to: '/agents', label: 'Agents', end: false, icon: ICONS.agents, title: 'Agents' },
  { to: '/connectors', label: 'Connectors', end: false, icon: ICONS.connectors, title: 'Connectors' },
]

function pageTitle(pathname: string): string {
  const match = NAV.find((item) => (item.end ? pathname === item.to : pathname.startsWith(item.to)))
  if (match) return match.title
  if (pathname.startsWith('/vlans/')) return 'VLAN detail'
  if (pathname.startsWith('/subnets/')) return 'Subnet detail'
  if (pathname.startsWith('/agents')) return 'Agents'
  return 'IPAM'
}

export function Layout() {
  const { user, logout } = useAuth()
  const { pathname } = useLocation()

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <aside className="fixed inset-y-0 left-0 flex w-60 flex-col border-r border-slate-800/80 bg-slate-900/40">
        <div className="flex h-16 items-center gap-3 border-b border-slate-800/80 px-5">
          <div className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-700 shadow-lg shadow-indigo-950/50">
            <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2} strokeLinecap="round" className="h-5 w-5" aria-hidden="true">
              <circle cx="12" cy="5" r="2.2" />
              <circle cx="5" cy="19" r="2.2" />
              <circle cx="19" cy="19" r="2.2" />
              <path d="M12 7.2 6.5 17 M12 7.2l5.5 9.8 M7.2 19h9.6" />
            </svg>
          </div>
          <div className="flex flex-col leading-tight">
            <span className="text-[15px] font-semibold tracking-tight text-slate-100">IPAM</span>
            <span className="text-[11px] text-slate-500">Address management</span>
          </div>
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto p-3">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-all duration-150 ${
                  isActive
                    ? 'bg-indigo-500/10 font-medium text-indigo-300'
                    : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <span
                    className={`absolute left-0 h-5 w-0.5 -translate-x-3 rounded-full bg-indigo-400 transition-all duration-150 ${
                      isActive ? 'opacity-100' : 'opacity-0'
                    }`}
                  />
                  <Icon d={item.icon} className={`h-4 w-4 transition-colors ${isActive ? 'text-indigo-400' : 'text-slate-500 group-hover:text-slate-300'}`} />
                  {item.label}
                </>
              )}
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-slate-800/80 p-3">
          <div className="flex items-center gap-2.5 rounded-lg px-2 py-1.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-800 text-xs font-semibold uppercase text-slate-300">
              {(user?.username ?? '?').slice(0, 1)}
            </div>
            <div className="min-w-0 flex-1 leading-tight">
              <p className="truncate text-sm text-slate-200">{user?.username ?? '—'}</p>
              <p className="text-[11px] text-slate-500">Signed in</p>
            </div>
          </div>
        </div>
      </aside>
      <div className="pl-60">
        <header className="sticky top-0 z-40 flex h-16 items-center justify-between border-b border-slate-800/80 bg-slate-950/80 px-6 backdrop-blur-md">
          <h1 className="text-sm font-semibold tracking-wide text-slate-200">{pageTitle(pathname)}</h1>
          <button onClick={logout} className="btn btn-secondary px-3 py-1.5">
            Log out
          </button>
        </header>
        <main className="p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
