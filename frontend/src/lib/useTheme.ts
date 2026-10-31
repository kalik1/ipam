import { useCallback, useEffect, useState } from 'react'
import { THEME_KEY, oppositeTheme, resolveTheme, type Theme } from './theme'

const DARK_QUERY = '(prefers-color-scheme: dark)'

function readStored(): string | null {
  try {
    return localStorage.getItem(THEME_KEY)
  } catch {
    return null
  }
}

function writeStored(theme: Theme) {
  try {
    localStorage.setItem(THEME_KEY, theme)
  } catch {
    return
  }
}

function applyTheme(theme: Theme) {
  const root = document.documentElement
  root.classList.remove(oppositeTheme(theme))
  root.classList.add(theme)
  root.style.colorScheme = theme
}

export function useTheme(): { theme: Theme; toggle: () => void } {
  const [theme, setTheme] = useState<Theme>(() => resolveTheme(readStored(), matchMedia(DARK_QUERY).matches))

  useEffect(() => {
    applyTheme(theme)
  }, [theme])

  useEffect(() => {
    const query = matchMedia(DARK_QUERY)
    function follow(event: MediaQueryListEvent) {
      setTheme(resolveTheme(readStored(), event.matches))
    }
    query.addEventListener('change', follow)
    return () => query.removeEventListener('change', follow)
  }, [])

  const toggle = useCallback(() => {
    const next = oppositeTheme(theme)
    writeStored(next)
    setTheme(next)
  }, [theme])

  return { theme, toggle }
}
