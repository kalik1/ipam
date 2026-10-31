import { memo, type CSSProperties } from 'react'
import type { AddressMapDevice, AddressSlot } from '@/lib/addressMap'
import { cx } from '@/lib/cx'
import { portClass } from '@/lib/portGlyph'

interface PortProps<D extends AddressMapDevice> {
  slot: AddressSlot<D>
  cable: string
  label: string
  selected?: boolean
  hovered?: boolean
  crosshair?: boolean
  bootIndex?: number
  onSelect?: (slot: AddressSlot<D>) => void
  onHover?: (slot: AddressSlot<D>) => void
}

function PortButton<D extends AddressMapDevice>({
  slot,
  cable,
  label,
  selected,
  hovered = false,
  crosshair = false,
  bootIndex = 0,
  onSelect,
  onHover,
}: PortProps<D>) {
  const style = { '--boot-index': bootIndex } as CSSProperties
  return (
    <button
      type="button"
      className={cx(portClass(slot), selected && 'sel', hovered ? 'hov' : crosshair && 'xh')}
      aria-label={label}
      aria-pressed={selected}
      style={style}
      onClick={() => onSelect?.(slot)}
      onMouseEnter={() => onHover?.(slot)}
      onFocus={() => onHover?.(slot)}
    >
      <span className="plug" style={{ backgroundColor: cable }} />
      <span className="led" />
      <span className="poolbar" />
      <span className="gwtag" />
    </button>
  )
}

export const Port = memo(PortButton) as typeof PortButton
