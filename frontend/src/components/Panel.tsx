import type { HTMLAttributes, ReactNode } from 'react'
import { cx } from '@/lib/cx'

interface PanelProps extends HTMLAttributes<HTMLElement> {
  as?: 'section' | 'div' | 'aside'
  hud?: boolean
}

export function Panel({ as: Tag = 'section', hud = false, className, ...rest }: PanelProps) {
  return <Tag className={cx('panel', hud && 'hud', className)} {...rest} />
}

export function PanelHeader({ title, children }: { title: ReactNode; children?: ReactNode }) {
  return (
    <div className="panel-head">
      <h2 className="panel-title">{title}</h2>
      {children}
    </div>
  )
}
