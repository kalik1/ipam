import { describe, expect, it } from 'vitest'
import { tooltipPosition } from './tooltip'

const viewport = { width: 1280, height: 800 }
const tip = { width: 120, height: 30 }

function rect(left: number, top: number, width = 40, height = 20) {
  return { left, top, width, height, right: left + width, bottom: top + height }
}

describe('tooltipPosition', () => {
  it('centers the tooltip right below its trigger', () => {
    expect(tooltipPosition(rect(600, 100), tip, viewport)).toEqual({ placement: 'below', left: 560, top: 120 })
  })

  it('goes above the trigger when there is no room below', () => {
    expect(tooltipPosition(rect(600, 760), tip, viewport)).toEqual({ placement: 'above', left: 560, top: 730 })
  })

  it('stays below when there is no room above either', () => {
    expect(tooltipPosition(rect(600, 10, 40, 780), tip, viewport).placement).toBe('below')
  })

  it('keeps a margin from the left and right edges of the viewport', () => {
    expect(tooltipPosition(rect(0, 100), tip, viewport).left).toBe(8)
    expect(tooltipPosition(rect(1260, 100, 20), tip, viewport).left).toBe(1152)
  })
})
