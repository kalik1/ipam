import { cx } from '@/lib/cx'
import { utilizationColor } from '@/lib/format'

const BAR_COLORS = {
  ok: 'var(--accent)',
  warn: 'var(--warn)',
  danger: 'var(--danger)',
} as const

const TEXT_COLORS = {
  ok: 'text-fg',
  warn: 'text-warn',
  danger: 'text-danger',
} as const

export function UtilizationBar({ used, total }: { used: number; total: number }) {
  const percent = total > 0 ? Math.round((used / total) * 1000) / 10 : 0
  const level = utilizationColor(percent)
  return (
    <div className="flex items-center gap-3">
      <span className="minibar w-32">
        <i style={{ width: `${Math.min(100, Math.max(0, percent))}%`, background: BAR_COLORS[level] }} />
      </span>
      <span className="mono whitespace-nowrap text-fg-2">
        {used}/{total}
      </span>
      <span className={cx('mono w-12 text-right', TEXT_COLORS[level])}>{percent}%</span>
    </div>
  )
}
