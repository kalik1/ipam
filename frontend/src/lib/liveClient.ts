import { createLiveEventParser, type LiveEvent } from './liveEvents'

const BACKOFF_BASE_MS = 1_000
const BACKOFF_MAX_MS = 30_000
const IDLE_TIMEOUT_MS = 45_000

export interface LiveClientOptions {
  url: string
  signal: AbortSignal
  getToken: () => string | null
  onStatus: (status: 'open' | 'down') => void
  onEvent: (event: LiveEvent) => void
  onUnauthorized: () => void
  idleTimeoutMs?: number
  fetch?: typeof fetch
  wait?: (ms: number, signal: AbortSignal) => Promise<void>
}

type Outcome = 'unauthorized' | 'failed' | 'closed'

export function backoffDelay(attempt: number): number {
  return Math.min(BACKOFF_MAX_MS, BACKOFF_BASE_MS * 2 ** attempt)
}

function waitFor(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    const done = () => {
      clearTimeout(timer)
      signal.removeEventListener('abort', done)
      resolve()
    }
    const timer = setTimeout(done, ms)
    signal.addEventListener('abort', done)
  })
}

function idleWatchdog(ms: number, onIdle: () => void) {
  let timer = setTimeout(onIdle, ms)
  return {
    reset: () => {
      clearTimeout(timer)
      timer = setTimeout(onIdle, ms)
    },
    stop: () => clearTimeout(timer),
  }
}

async function readEvents(
  body: ReadableStream<Uint8Array>,
  onEvent: (event: LiveEvent) => void,
  onBytes: () => void,
): Promise<void> {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  const parse = createLiveEventParser()
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) return
      onBytes()
      parse(decoder.decode(value, { stream: true })).forEach(onEvent)
    }
  } catch {
    return
  }
}

async function connectOnce(options: LiveClientOptions): Promise<Outcome> {
  const token = options.getToken()
  if (!token) return 'unauthorized'
  const connection = new AbortController()
  const abort = () => connection.abort()
  options.signal.addEventListener('abort', abort)
  try {
    let response: Response
    try {
      response = await (options.fetch ?? fetch)(options.url, {
        headers: { Authorization: `Bearer ${token}`, Accept: 'text/event-stream' },
        cache: 'no-store',
        signal: connection.signal,
      })
    } catch {
      return 'failed'
    }
    if (response.status === 401) return 'unauthorized'
    if (!response.ok || !response.body) return 'failed'
    options.onStatus('open')
    const watchdog = idleWatchdog(options.idleTimeoutMs ?? IDLE_TIMEOUT_MS, abort)
    await readEvents(response.body, options.onEvent, watchdog.reset)
    watchdog.stop()
    return 'closed'
  } finally {
    options.signal.removeEventListener('abort', abort)
  }
}

export async function runLiveClient(options: LiveClientOptions): Promise<void> {
  const { signal } = options
  const wait = options.wait ?? waitFor
  let attempt = 0
  while (!signal.aborted) {
    const outcome = await connectOnce(options)
    if (signal.aborted) return
    if (outcome === 'unauthorized') {
      options.onUnauthorized()
      return
    }
    if (outcome === 'closed') attempt = 0
    options.onStatus('down')
    await wait(backoffDelay(attempt), signal)
    attempt += 1
  }
}
