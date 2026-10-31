import { cloneElement, useEffect, useId, useLayoutEffect, useRef, useState, type FocusEvent, type MouseEvent, type ReactElement } from 'react'
import { createPortal } from 'react-dom'
import { cx } from '@/lib/cx'
import { tooltipPosition, type TooltipPosition } from '@/lib/tooltip'

interface TriggerProps {
  'aria-describedby'?: string
  tabIndex?: number
  onMouseEnter?: (event: MouseEvent<HTMLElement>) => void
  onMouseLeave?: (event: MouseEvent<HTMLElement>) => void
  onFocus?: (event: FocusEvent<HTMLElement>) => void
  onBlur?: (event: FocusEvent<HTMLElement>) => void
}

interface TooltipProps {
  tip: string
  children: ReactElement<TriggerProps>
  describe?: boolean
  focusable?: boolean
}

function contains(element: Element | null, target: EventTarget | null): boolean {
  return element !== null && target instanceof Node && element.contains(target)
}

function useDismiss(open: boolean, close: () => void) {
  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close()
    }
    document.addEventListener('keydown', onKey)
    window.addEventListener('scroll', close, true)
    window.addEventListener('resize', close)
    return () => {
      document.removeEventListener('keydown', onKey)
      window.removeEventListener('scroll', close, true)
      window.removeEventListener('resize', close)
    }
  }, [open, close])
}

export function Tooltip({ tip, children, describe = true, focusable = false }: TooltipProps) {
  const id = useId()
  const tipRef = useRef<HTMLDivElement>(null)
  const [trigger, setTrigger] = useState<HTMLElement | null>(null)
  const [position, setPosition] = useState<TooltipPosition | null>(null)
  const [close] = useState(() => () => setTrigger(null))
  useDismiss(trigger !== null, close)

  useLayoutEffect(() => {
    const element = tipRef.current
    if (!trigger || !element) {
      setPosition(null)
      return
    }
    const { width, height } = element.getBoundingClientRect()
    setPosition(tooltipPosition(trigger.getBoundingClientRect(), { width, height }, { width: window.innerWidth, height: window.innerHeight }))
  }, [trigger, tip])

  if (!tip) return children

  const own = children.props
  const triggerProps: TriggerProps = {
    'aria-describedby': describe ? cx(own['aria-describedby'], id) : own['aria-describedby'],
    tabIndex: focusable ? (own.tabIndex ?? 0) : own.tabIndex,
    onMouseEnter: (event) => {
      own.onMouseEnter?.(event)
      setTrigger(event.currentTarget)
    },
    onMouseLeave: (event) => {
      own.onMouseLeave?.(event)
      if (!contains(tipRef.current, event.relatedTarget)) close()
    },
    onFocus: (event) => {
      own.onFocus?.(event)
      if (event.currentTarget.matches(':focus-visible')) setTrigger(event.currentTarget)
    },
    onBlur: (event) => {
      own.onBlur?.(event)
      close()
    },
  }

  return (
    <>
      {cloneElement(children, triggerProps)}
      {createPortal(
        <div
          ref={tipRef}
          id={id}
          role="tooltip"
          aria-hidden={describe ? undefined : true}
          hidden={trigger === null}
          className={cx('tooltip', position?.placement ?? 'below', !position && 'measuring')}
          style={position ? { left: position.left, top: position.top } : undefined}
          onMouseLeave={(event) => {
            if (!contains(trigger, event.relatedTarget)) close()
          }}
        >
          <span className="tooltip-body">{tip}</span>
        </div>,
        document.body,
      )}
    </>
  )
}
