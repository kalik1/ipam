export type Theme = 'dark' | 'light'

export const THEME_KEY = 'ipam_theme'

export function resolveTheme(stored: string | null, systemPrefersDark: boolean): Theme {
  if (stored === 'dark' || stored === 'light') return stored
  return systemPrefersDark ? 'dark' : 'light'
}

export function oppositeTheme(theme: Theme): Theme {
  return theme === 'dark' ? 'light' : 'dark'
}
