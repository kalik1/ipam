export function EmptyState({ title, message }: { title: string; message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-slate-800 bg-slate-900 text-slate-600">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6" aria-hidden="true">
          <path d="M4 13h4l2 3h4l2-3h4" />
          <path d="M5.5 6.5 4 13v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4l-1.5-6.5A2 2 0 0 0 16.55 5h-13.1a2 2 0 0 0-1.95 1.5z" />
        </svg>
      </div>
      <div>
        <p className="text-sm font-medium text-slate-300">{title}</p>
        {message && <p className="mt-1 text-sm text-slate-500">{message}</p>}
      </div>
    </div>
  )
}
