import { useCallback, useEffect, useState } from 'react'
import api, { getErrorMessage } from './api'
import { RESULT_TIMEOUT_MS, commandOutcome, type CommandResultEvent, type CommandRun } from './commandResult'
import { useLiveEvent } from './live'
import type { AgentResult } from '../types'

export type { CommandRun } from './commandResult'

export interface CommandRunControls {
  run: CommandRun
  start: (send: () => Promise<string>, failure: string) => Promise<void>
  reset: () => void
}

const IDLE: CommandRun = { status: 'idle' }
const RECENT_RESULTS_LIMIT = 20

export function isRunPending(run: CommandRun): boolean {
  return run.status === 'sending' || run.status === 'waiting'
}

async function latestResult(agent: string, signal: AbortSignal): Promise<AgentResult | null> {
  try {
    return (await api.get<AgentResult>(`/agents/${agent}/results`, { signal })).data
  } catch {
    return null
  }
}

export function useCommandRun(agent: string): CommandRunControls {
  const [run, setRun] = useState<CommandRun>(IDLE)
  const [results, setResults] = useState<CommandResultEvent[]>([])
  const commandId = run.status === 'waiting' ? run.commandId : null
  const arrived = commandId ? results.find((result) => result.commandId === commandId) : undefined

  useLiveEvent((event) => {
    if (event.type !== 'command.result' || event.data.agent !== agent) return
    setResults((current) => [event.data, ...current].slice(0, RECENT_RESULTS_LIMIT))
  })

  useEffect(() => {
    if (!commandId) return
    const controller = new AbortController()
    const settle = () => {
      void latestResult(agent, controller.signal).then((latest) => {
        if (!controller.signal.aborted) setRun(commandOutcome(commandId, arrived, latest, new Date().toISOString()))
      })
    }
    const timer = arrived ? undefined : setTimeout(settle, RESULT_TIMEOUT_MS)
    if (arrived) settle()
    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [agent, commandId, arrived])

  const start = useCallback(async (send: () => Promise<string>, failure: string) => {
    setRun({ status: 'sending' })
    try {
      setRun({ status: 'waiting', commandId: await send() })
    } catch (err) {
      setRun({ status: 'error', message: getErrorMessage(err, failure) })
    }
  }, [])

  const reset = useCallback(() => setRun(IDLE), [])

  return { run, start, reset }
}
