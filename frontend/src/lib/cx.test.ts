import { describe, expect, it } from 'vitest'
import { cx } from './cx'

describe('cx', () => {
  it('joins the class names that are set and skips the rest', () => {
    expect(cx('btn', false, 'btn-primary', null, undefined, '', 'w-full')).toBe('btn btn-primary w-full')
  })
})
