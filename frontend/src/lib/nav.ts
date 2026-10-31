export type NavCountKey = 'vlans' | 'subnets' | 'devices' | 'agents' | 'connectors' | 'apiKeys'

export type NavIcon =
  | 'dashboard'
  | 'topology'
  | 'vlans'
  | 'subnets'
  | 'devices'
  | 'agents'
  | 'connectors'
  | 'scanReports'
  | 'apiKeys'

export interface NavItem {
  to: string
  label: string
  icon: NavIcon
  countKey?: NavCountKey
}

export interface NavGroup {
  label: string | null
  items: NavItem[]
}

export const NAV_GROUPS: NavGroup[] = [
  { label: null, items: [{ to: '/', label: 'Dashboard', icon: 'dashboard' }] },
  {
    label: 'Network',
    items: [
      { to: '/topology', label: 'Topology', icon: 'topology' },
      { to: '/vlans', label: 'VLANs', icon: 'vlans', countKey: 'vlans' },
      { to: '/subnets', label: 'Subnets', icon: 'subnets', countKey: 'subnets' },
      { to: '/devices', label: 'Devices', icon: 'devices', countKey: 'devices' },
    ],
  },
  {
    label: 'Discovery',
    items: [
      { to: '/agents', label: 'Agents', icon: 'agents', countKey: 'agents' },
      { to: '/connectors', label: 'Connectors', icon: 'connectors', countKey: 'connectors' },
      { to: '/scan-reports', label: 'Scan reports', icon: 'scanReports' },
    ],
  },
  { label: 'Access', items: [{ to: '/api-keys', label: 'API keys', icon: 'apiKeys', countKey: 'apiKeys' }] },
]

export interface Crumb {
  label: string
  to?: string
}

export interface CrumbNames {
  vlans: Record<number, string>
  subnets: Record<number, string>
}

const NAV_ITEMS = NAV_GROUPS.flatMap((group) => group.items)

const DETAIL_ROUTES = [
  { pattern: /^\/subnets\/(\d+)$/, list: '/subnets', names: 'subnets', fallback: 'Subnet detail' },
  { pattern: /^\/vlans\/(\d+)$/, list: '/vlans', names: 'vlans', fallback: 'VLAN detail' },
] as const

function listLabel(to: string): string {
  return NAV_ITEMS.find((item) => item.to === to)?.label ?? to
}

export function breadcrumbs(pathname: string, names: CrumbNames): Crumb[] {
  const item = NAV_ITEMS.find((candidate) => candidate.to === pathname)
  if (item) return [{ label: item.label }]
  for (const route of DETAIL_ROUTES) {
    const match = route.pattern.exec(pathname)
    if (!match) continue
    const name = names[route.names][Number(match[1])]
    return [{ label: listLabel(route.list), to: route.list }, { label: name ?? route.fallback }]
  }
  return []
}
