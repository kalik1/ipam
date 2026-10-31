import { utilizationColor } from '@/lib/format'

const BAR_COLORS = {
  ok: 'bg-indigo-500',
  warn: 'bg-amber-500',
  danger: 'bg-red-500',
} as const

export function UtilizationBar({ used, total }: { used: number; total: number }) {
  const percent = total > 0 ? Math.round((used / total) * 1000) / 10 : 0
  const level = utilizationColor(percent)
  return (
    <div className="flex items-center gap-3">
      <div className="h-1.5 w-32 overflow-hidden rounded-full bg-slate-800">
        <div
          className={`h-full animate-bar-fill rounded-full ${BAR_COLORS[level]} transition-[width] duration-500 ease-out`}
          style={{ width: `${Math.min(100, Math.max(0, percent))}%` }}
        />
      </div>
      <span className="whitespace-nowrap text-xs tabular-nums text-slate-400">
        {used}/{total}
      </span>
      <span className={`w-10 text-right text-xs font-medium tabular-nums ${level === 'danger' ? 'text-red-400' : level === 'warn' ? 'text-amber-400' : 'text-slate-300'}`}>
        {percent}%
      </span>
    </div>
  )
}
