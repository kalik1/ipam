import { Link } from 'react-router-dom'
import type { Crumb } from '@/lib/nav'
import { useTheme } from '@/lib/useTheme'
import { Button } from '@/components/Button'
import { Tooltip } from '@/components/Tooltip'
import { ThemeIcon } from '@/components/icons'
import { GlobalSearch } from './GlobalSearch'
import { ScanNow } from './ScanNow'

function Breadcrumbs({ crumbs }: { crumbs: Crumb[] }) {
  return (
    <nav aria-label="Breadcrumb">
      <ol className="crumbs">
        {crumbs.map((crumb, index) => (
          <li key={`${index}-${crumb.label}`}>
            {crumb.to ? (
              <Link to={crumb.to}>{crumb.label}</Link>
            ) : (
              <span aria-current={index === crumbs.length - 1 ? 'page' : undefined}>{crumb.label}</span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  )
}

export function TopBar({ crumbs, actionsRef }: { crumbs: Crumb[]; actionsRef: (element: HTMLDivElement | null) => void }) {
  const { theme, toggle } = useTheme()
  const themeLabel = theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'
  return (
    <header className="topbar">
      <Breadcrumbs crumbs={crumbs} />
      <div className="topbar-tools">
        <GlobalSearch />
        <ScanNow />
        <Tooltip tip={themeLabel} describe={false}>
          <Button icon aria-label={themeLabel} onClick={toggle}>
            <ThemeIcon />
          </Button>
        </Tooltip>
        <div ref={actionsRef} className="page-actions" />
      </div>
    </header>
  )
}
