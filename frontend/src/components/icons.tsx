import type { ReactNode } from 'react'
import type { NavIcon as NavIconName } from '@/lib/nav'

function Stroke({ children, size = 16 }: { children: ReactNode; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.4}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  )
}

const NAV_PATHS: Record<NavIconName, ReactNode> = {
  dashboard: (
    <>
      <rect x="2" y="2" width="5" height="5" rx="1" />
      <rect x="9" y="2" width="5" height="5" rx="1" />
      <rect x="2" y="9" width="5" height="5" rx="1" />
      <rect x="9" y="9" width="5" height="5" rx="1" />
    </>
  ),
  topology: (
    <>
      <circle cx="8" cy="3" r="1.6" />
      <circle cx="3" cy="13" r="1.6" />
      <circle cx="13" cy="13" r="1.6" />
      <path d="M8 4.6V8M8 8l-4.2 3.6M8 8l4.2 3.6" />
    </>
  ),
  vlans: <path d="M2 4h12M2 8h12M2 12h12" />,
  subnets: (
    <>
      <rect x="2" y="3" width="12" height="10" rx="1.5" />
      <path d="M2 8h12M8 3v10" />
    </>
  ),
  devices: (
    <>
      <rect x="2" y="3" width="12" height="8" rx="1" />
      <path d="M6 14h4M8 11v3" />
    </>
  ),
  agents: (
    <>
      <circle cx="8" cy="8" r="2" />
      <path d="M3.8 3.8a6 6 0 0 0 0 8.4M12.2 3.8a6 6 0 0 1 0 8.4" />
    </>
  ),
  connectors: <path d="M6 2v3M10 2v3M4.5 5h7v3a3.5 3.5 0 0 1-7 0zM8 11.5V14" />,
  scanReports: (
    <>
      <path d="M4 2h6l2 2v10H4z" />
      <path d="M6 7h4M6 10h4" />
    </>
  ),
  apiKeys: (
    <>
      <circle cx="5.5" cy="10.5" r="2.5" />
      <path d="M7.3 8.7L13 3M11 5l1.5 1.5" />
    </>
  ),
}

export function NavIcon({ name }: { name: NavIconName }) {
  return <Stroke>{NAV_PATHS[name]}</Stroke>
}

export function CloseIcon() {
  return (
    <Stroke>
      <path d="M4 4l8 8M12 4l-8 8" />
    </Stroke>
  )
}

export function ThemeIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.4} aria-hidden="true">
      <circle cx="8" cy="8" r="5.5" />
      <path d="M8 2.5v11a5.5 5.5 0 0 0 0-11z" fill="currentColor" />
    </svg>
  )
}

export function BrandMark({ ledClassName }: { ledClassName: string }) {
  return (
    <svg width="26" height="26" viewBox="0 0 26 26" aria-hidden="true">
      <rect x="1" y="5" width="24" height="16" rx="2.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <rect x="5" y="9" width="4" height="3" rx=".6" fill="currentColor" />
      <rect x="11" y="9" width="4" height="3" rx=".6" fill="currentColor" opacity=".45" />
      <rect x="17" y="9" width="4" height="3" rx=".6" fill="currentColor" />
      <rect x="5" y="14" width="4" height="3" rx=".6" fill="currentColor" opacity=".45" />
      <rect x="11" y="14" width="4" height="3" rx=".6" fill="currentColor" />
      <rect x="17" y="14" width="4" height="3" rx=".6" fill="currentColor" opacity=".45" />
      <circle className={ledClassName} cx="22" cy="7.5" r="1.3" />
    </svg>
  )
}
