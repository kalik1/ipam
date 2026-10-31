import type { ReactNode } from 'react'
import { cx } from '@/lib/cx'

export function Table({ children, className, maxHeight }: { children: ReactNode; className?: string; maxHeight?: number }) {
  return (
    <div className="table-box" style={maxHeight ? { maxHeight } : undefined}>
      <table className={cx('tbl', className)}>{children}</table>
    </div>
  )
}

export function TableMessage({ colSpan, children }: { colSpan: number; children: ReactNode }) {
  return (
    <tr>
      <td colSpan={colSpan} className="message">
        {children}
      </td>
    </tr>
  )
}
