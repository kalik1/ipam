import type { Device } from '@/types'

export function Badge({ status }: { status: Device['status'] }) {
  const online = status === 'online'
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${
        online
          ? 'bg-emerald-500/10 text-emerald-400 ring-emerald-500/30'
          : 'bg-slate-500/10 text-slate-400 ring-slate-500/30'
      }`}
    >
      <span className="relative flex h-1.5 w-1.5">
        {online && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />}
        <span className={`relative inline-flex h-1.5 w-1.5 rounded-full ${online ? 'bg-emerald-400' : 'bg-slate-500'}`} />
      </span>
      {online ? 'Online' : 'Offline'}
    </span>
  )
}
