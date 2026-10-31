import { useCallback, useEffect, useState } from 'react'
import api, { getErrorMessage } from './api'
import { awaitCommandResult } from './commandResult'
import type { AgentResult } from '../types'

export type CommandRun =
  | { status: 'idle' }
  | { status: 'sending' }
  | { status: 'waiting'; commandId: string }
  | { status: 'done'; result: AgentResult }
  | { status: 'timeout' }
  | { status: 'error'; message: string }

export interface CommandRunControls {
  run: CommandRun
  start: (send: () => Promise<string>, failure: string) => Promise<void>
  reset: () => void
}

const IDLE: CommandRun = { status: 'idle' }

export function isRunPending(run: CommandRun): boolean {
  return run.status === 'sending' || run.status === 'waiting'
}

export function useCommandRun(agent: string): CommandRunControls {
  const [run, setRun] = useState<CommandRun>(IDLE)
  const commandId = run.status === 'waiting' ? run.commandId : null

  useEffect(() => {
    if (!commandId) return
    const controller = new AbortController()
    void awaitCommandResult({
      commandId,
      signal: controller.signal,
      fetchResult: async () => (await api.get<AgentResult>(`/agents/${agent}/results`, { signal: controller.signal })).data,
    }).then((result) => {
      if (controller.signal.aborted) return
      setRun(result ? { status: 'done', result } : { status: 'timeout' })
    })
    return () => controller.abort()
  }, [agent, commandId])

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
