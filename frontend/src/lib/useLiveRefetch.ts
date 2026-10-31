import { useEffect, useRef } from 'react'
import { useLiveEvent } from './live'
import type { LiveEvent } from './liveEvents'

const LIVE_REFETCH_DELAY_MS = 150

export function useLiveRefetch(matches: (event: LiveEvent) => boolean, refetch: () => void): void {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useLiveEvent((event) => {
    if (timer.current || !matches(event)) return
    timer.current = setTimeout(() => {
      timer.current = null
      refetch()
    }, LIVE_REFETCH_DELAY_MS)
  })

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current)
    },
    [],
  )
}
