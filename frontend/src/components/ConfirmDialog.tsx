import { Button } from './Button'
import { Modal } from './Modal'

export function ConfirmDialog({
  title,
  message,
  confirmLabel = 'Delete',
  loading = false,
  onConfirm,
  onCancel,
}: {
  title: string
  message: string
  confirmLabel?: string
  loading?: boolean
  onConfirm: () => void
  onCancel: () => void
}) {
  return (
    <Modal title={title} onClose={onCancel}>
      <p className="text-fg-2">{message}</p>
      <div className="mt-5 flex flex-wrap justify-end gap-2">
        <Button onClick={onCancel}>Cancel</Button>
        <Button variant="danger" onClick={onConfirm} disabled={loading} aria-busy={loading}>
          {loading ? 'Deleting...' : confirmLabel}
        </Button>
      </div>
    </Modal>
  )
}
