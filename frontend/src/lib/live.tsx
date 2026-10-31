import { createContext, useContext, useEffect, useReducer, useRef, useState, type Dispatch, type ReactNode } from 'react'
import api, { TOKEN_KEY } from './api'
import { runLiveClient } from './liveClient'
import type { LiveEvent } from './liveEvents'
import { INITIAL_LIVE_STATE, PULSE_MS, liveReducer, type LiveAction, type LiveState } from './liveState'
import type { Agent } from '../types'

type LiveListener = (event: LiveEvent) => void

const EVENTS_URL = '/api/v1/events'

const LiveStateContext = createContext<LiveState>(INITIAL_LIVE_STATE)
const LiveListenersContext = createContext<Set<LiveListener> | null>(null)

function redirectToLogin() {
  localStorage.removeItem(TOKEN_KEY)
  window.location.href = '/login'
}

function useSettledPulses(received: number, dispatch: Dispatch<LiveAction>) {
  const [timers] = useState(() => new Set<ReturnType<typeof setTimeout>>())

  useEffect(() => {
    if (received === 0) return
    const timer = setTimeout(() => {
      timers.delete(timer)
      dispatch({ kind: 'settle', seq: received })
    }, PULSE_MS)
    timers.add(timer)
  }, [received, dispatch, timers])

  useEffect(
    () => () => {
      timers.forEach(clearTimeout)
      timers.clear()
    },
    [timers],
  )
}

export function LiveProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(liveReducer, INITIAL_LIVE_STATE)
  const [listeners] = useState(() => new Set<LiveListener>())
  useSettledPulses(state.received, dispatch)

  useEffect(() => {
    const controller = new AbortController()
    const loadAgents = () => {
      api
        .get<Agent[]>('/agents', { signal: controller.signal })
        .then(({ data }) => dispatch({ kind: 'agents', agents: data }))
        .catch(() => undefined)
    }
    void runLiveClient({
      url: EVENTS_URL,
      signal: controller.signal,
      getToken: () => localStorage.getItem(TOKEN_KEY),
      onStatus: (status) => {
        dispatch({ kind: 'link', status })
        if (status === 'open') loadAgents()
      },
      onEvent: (event) => {
        dispatch({ kind: 'event', event })
        listeners.forEach((listener) => listener(event))
      },
      onUnauthorized: redirectToLogin,
    })
    return () => controller.abort()
  }, [listeners])

  return (
    <LiveListenersContext.Provider value={listeners}>
      <LiveStateContext.Provider value={state}>{children}</LiveStateContext.Provider>
    </LiveListenersContext.Provider>
  )
}

export function useLive(): LiveState {
  return useContext(LiveStateContext)
}

export function useLiveEvent(listener: LiveListener): void {
  const listeners = useContext(LiveListenersContext)
  const latest = useRef(listener)

  useEffect(() => {
    latest.current = listener
  })

  useEffect(() => {
    if (!listeners) return
    const forward: LiveListener = (event) => latest.current(event)
    listeners.add(forward)
    return () => {
      listeners.delete(forward)
    }
  }, [listeners])
}
