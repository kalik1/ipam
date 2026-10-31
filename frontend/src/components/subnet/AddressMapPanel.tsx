import { useMemo } from 'react'
import type { AddressBlock, AddressMap, AddressSlot } from '@/lib/addressMap'
import { cx } from '@/lib/cx'
import { deviceName, portDescription } from '@/lib/portGlyph'
import type { Device } from '@/types'
import { Button } from '@/components/Button'
import { Port } from '@/components/addressMap/Port'

type Slot = AddressSlot<Device>

const COLUMNS = Array.from({ length: 16 }, (_, column) => column)
const MAX_BLOCK_OPTIONS = 1024

function readout(slot: Slot | null) {
  if (!slot) return { ip: '--', name: '--', link: 'none', linkClass: '', mac: '--:--:--:--:--:--' }
  const device = slot.device
  let name = 'free'
  if (device) name = deviceName(device)
  else if (slot.notUsable) name = `${slot.notUsable} address`
  else if (slot.gateway) name = 'gateway'
  else if (slot.pools.length > 0) name = 'reserved, DHCP pool'
  return {
    ip: slot.ip,
    name,
    link: device ? (device.status === 'online' ? 'up' : 'down') : 'none',
    linkClass: device ? (device.status === 'online' ? 'ok' : 'no') : '',
    mac: device?.mac || '--:--:--:--:--:--',
  }
}

function Chevron({ direction }: { direction: 'left' | 'right' }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={direction === 'left' ? 'M10 3L5 8l5 5' : 'M6 3l5 5-5 5'} />
    </svg>
  )
}

function BlockSelector({ map, block, onChange }: { map: AddressMap<Device>; block: AddressBlock; onChange: (index: number) => void }) {
  const options = useMemo(() => {
    if (map.blockCount > MAX_BLOCK_OPTIONS) return []
    return Array.from({ length: map.blockCount }, (_, index) => {
      const candidate = map.block(index)
      return { index, label: `${candidate.cidr}, ${candidate.counters.occupied} occupied, ${candidate.counters.free} free` }
    })
  }, [map])
  return (
    <div className="blockbar">
      <span>/24 block</span>
      <Button icon aria-label="Previous block" disabled={block.index === 0} onClick={() => onChange(block.index - 1)}>
        <Chevron direction="left" />
      </Button>
      {options.length > 0 ? (
        <select className="input mono" aria-label="Block" value={block.index} onChange={(event) => onChange(Number(event.target.value))}>
          {options.map((option) => (
            <option key={option.index} value={option.index}>
              {option.label}
            </option>
          ))}
        </select>
      ) : (
        <span className="mono text-fg">{block.cidr}</span>
      )}
      <Button icon aria-label="Next block" disabled={block.index >= map.blockCount - 1} onClick={() => onChange(block.index + 1)}>
        <Chevron direction="right" />
      </Button>
      <span className="text-fg-3">
        {block.index + 1} of {map.blockCount}
      </span>
    </div>
  )
}

interface AddressMapPanelProps {
  map: AddressMap<Device>
  blockIndex: number
  cable: string
  selectedIp: string | null
  hover: number | null
  booting: boolean
  onBlockChange: (index: number) => void
  onSelect: (slot: Slot) => void
  onHover: (slot: Slot | null) => void
}

export function AddressMapPanel({ map, blockIndex, cable, selectedIp, hover, booting, onBlockChange, onSelect, onHover }: AddressMapPanelProps) {
  const block = useMemo(() => map.block(blockIndex), [map, blockIndex])
  const rows = useMemo(() => map.rows(block), [map, block])
  const hoverInBlock = hover !== null && hover >= block.first && hover <= block.last
  const hoverRow = hoverInBlock ? hover - (hover % 16) : null
  const hoverColumn = hoverInBlock ? hover % 16 : null
  const focus = readout((hoverInBlock ? map.slot(hover) : null) ?? (selectedIp ? map.slot(selectedIp) : null))

  return (
    <section className="panel mappanel hud" aria-label="Address map">
      <div className="facehead">
        <h2 className="panel-title">Address map</h2>
        <span className="vent" aria-hidden="true" />
        <div className="lcd" aria-live="polite">
          <span>
            <span className="k">ip</span>
            {focus.ip}
          </span>
          <span>
            <span className="k">host</span>
            {focus.name}
          </span>
          <span className={focus.linkClass}>
            <span className="k">link</span>
            {focus.link}
          </span>
          <span>
            <span className="k">hw</span>
            {focus.mac}
          </span>
        </div>
        <span className="maplegend">
          <span className="lg">
            <span className="sw gw" />
            Gateway
          </span>
          <span className="lg">
            <span className="sw pool" />
            DHCP pool
          </span>
          <span className="lg">
            <span className="sw na" />
            Not usable
          </span>
        </span>
      </div>
      {map.blockCount > 1 && <BlockSelector map={map} block={block} onChange={onBlockChange} />}
      <div className="faceplate">
        <div className="ear" aria-hidden="true">
          <span className="screw" />
          <span className="screw" />
        </div>
        <div
          className={cx('ports', booting && 'booting')}
          role="group"
          aria-label={`Addresses of ${block.cidr}`}
          onMouseLeave={() => onHover(null)}
          onBlur={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget)) onHover(null)
          }}
        >
          <div className="prow" aria-hidden="true">
            <span />
            {[COLUMNS.slice(0, 8), COLUMNS.slice(8)].map((bank, index) => (
              <div className="bank" key={index}>
                {bank.map((column) => (
                  <span key={column} className={cx('collab mono', column === hoverColumn && 'hot')}>
                    {column}
                  </span>
                ))}
              </div>
            ))}
          </div>
          {rows.map((row) => (
            <div className="prow" key={row.first}>
              <span className={cx('rlabel mono', row.first === hoverRow && 'hot')} aria-hidden="true">
                .{row.first % 256}
              </span>
              {[row.cells.slice(0, 8), row.cells.slice(8)].map((bank, index) => (
                <div className="bank" key={index}>
                  {bank.map((cell, offset) => {
                    const column = index * 8 + offset
                    if (!cell) return <span key={column} className="port-spacer" aria-hidden="true" />
                    return (
                      <Port
                        key={column}
                        slot={cell}
                        cable={cable}
                        label={portDescription(cell)}
                        selected={cell.ip === selectedIp}
                        hovered={cell.value === hover}
                        crosshair={row.first === hoverRow || column === hoverColumn}
                        bootIndex={cell.value - block.first}
                        onSelect={onSelect}
                        onHover={onHover}
                      />
                    )
                  })}
                </div>
              ))}
            </div>
          ))}
        </div>
        <div className="ear r" aria-hidden="true">
          <span className="screw" />
          <span className="screw" />
        </div>
      </div>
    </section>
  )
}
