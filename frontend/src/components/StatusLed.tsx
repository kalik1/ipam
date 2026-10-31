import { cx } from '@/lib/cx'
import { Tooltip } from '@/components/Tooltip'

export type LedState = 'on' | 'off' | 'error' | 'pending'

const LED_CLASS: Record<LedState, string> = { on: 'on', off: 'off', error: 'err', pending: 'wait' }

export function StatusLed({ state, label, className }: { state: LedState; label?: string; className?: string }) {
  const led = <span className={cx('dot', LED_CLASS[state], className)} role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : true} />
  return label ? (
    <Tooltip tip={label} describe={false}>
      {led}
    </Tooltip>
  ) : (
    led
  )
}
