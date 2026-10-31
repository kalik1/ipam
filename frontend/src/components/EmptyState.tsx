export function EmptyState({ title, message }: { title: string; message?: string }) {
  return (
    <div className="empty">
      <span className="empty-jack" aria-hidden="true" />
      <div>
        <p className="font-semibold text-fg">{title}</p>
        {message && <p className="mt-1 text-fg-3">{message}</p>}
      </div>
    </div>
  )
}
