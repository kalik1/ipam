import { useEffect, useId, useRef, type ReactNode } from 'react'
import { Button } from './Button'
import { CloseIcon } from './icons'

export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const titleId = useId()
  const dialogRef = useRef<HTMLDivElement>(null)
  const onCloseRef = useRef(onClose)

  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const dialog = dialogRef.current
    if (dialog && !dialog.contains(document.activeElement)) dialog.focus()
    function handleKey(event: KeyboardEvent) {
      if (event.key === 'Escape') onCloseRef.current()
    }
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('keydown', handleKey)
      previous?.focus()
    }
  }, [])

  return (
    <div
      className="modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1} className="modal panel hud">
        <div className="panel-head">
          <h2 id={titleId} className="panel-title">
            {title}
          </h2>
          <Button variant="ghost" icon aria-label="Close" className="ml-auto" onClick={onClose}>
            <CloseIcon />
          </Button>
        </div>
        <div className="panel-body">{children}</div>
      </div>
    </div>
  )
}
