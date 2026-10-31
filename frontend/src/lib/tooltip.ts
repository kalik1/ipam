export interface TriggerRect {
  left: number
  top: number
  width: number
  bottom: number
}

export interface Size {
  width: number
  height: number
}

export type TooltipPlacement = 'below' | 'above'

export interface TooltipPosition {
  placement: TooltipPlacement
  left: number
  top: number
}

const MARGIN = 8

export function tooltipPosition(trigger: TriggerRect, tip: Size, viewport: Size): TooltipPosition {
  const centered = trigger.left + trigger.width / 2 - tip.width / 2
  const left = Math.max(MARGIN, Math.min(centered, viewport.width - tip.width - MARGIN))
  const fitsBelow = trigger.bottom + tip.height <= viewport.height - MARGIN
  const fitsAbove = trigger.top - tip.height >= MARGIN
  if (!fitsBelow && fitsAbove) return { placement: 'above', left, top: trigger.top - tip.height }
  return { placement: 'below', left, top: trigger.bottom }
}
