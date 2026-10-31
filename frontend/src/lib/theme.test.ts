import { describe, expect, it } from 'vitest'
import indexHtml from '../../index.html?raw'
import { THEME_KEY, resolveTheme } from './theme'

function runPrePaintScript(stored: string | null, systemPrefersDark: boolean) {
  const match = /<script>([\s\S]*?)<\/script>/.exec(indexHtml)
  if (!match) throw new Error('index.html has no inline pre-paint script')
  const classes: string[] = []
  const style: { colorScheme?: string } = {}
  const document = { documentElement: { classList: { add: (name: string) => classes.push(name) }, style } }
  const localStorage = { getItem: (key: string) => (key === THEME_KEY ? stored : null) }
  const matchMedia = (query: string) => ({ matches: query === '(prefers-color-scheme: dark)' && systemPrefersDark })
  new Function('document', 'localStorage', 'matchMedia', match[1])(document, localStorage, matchMedia)
  return { classes, colorScheme: style.colorScheme }
}

describe('resolveTheme', () => {
  it('follows the system preference when nothing is stored', () => {
    expect(resolveTheme(null, true)).toBe('dark')
    expect(resolveTheme(null, false)).toBe('light')
  })

  it('uses the stored choice over the system preference', () => {
    expect(resolveTheme('light', true)).toBe('light')
    expect(resolveTheme('dark', false)).toBe('dark')
  })

  it('ignores a stored value that is not a theme', () => {
    expect(resolveTheme('sepia', true)).toBe('dark')
    expect(resolveTheme('', false)).toBe('light')
  })
})

describe('pre-paint theme script in index.html', () => {
  const cases: Array<[string | null, boolean]> = [
    [null, true],
    [null, false],
    ['light', true],
    ['dark', false],
    ['sepia', true],
    ['sepia', false],
  ]

  it.each(cases)('applies the same theme as resolveTheme (stored %s, system dark %s)', (stored, systemDark) => {
    const expected = resolveTheme(stored, systemDark)
    expect(runPrePaintScript(stored, systemDark)).toEqual({ classes: [expected], colorScheme: expected })
  })

  it('reads the choice stored under THEME_KEY, the key the theme toggle writes', () => {
    expect(indexHtml).toContain(`localStorage.getItem('${THEME_KEY}')`)
  })
})
