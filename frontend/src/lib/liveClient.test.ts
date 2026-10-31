import { describe, expect, it } from 'vitest'
import { backoffDelay, runLiveClient } from './liveClient'

type Reply = string[] | number | Error

function sseResponse(chunks: string[], signal: AbortSignal | null | undefined, keepOpen: boolean): Response {
  const encoder = new TextEncoder()
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      chunks.forEach((chunk) => controller.enqueue(encoder.encode(chunk)))
      if (!keepOpen) controller.close()
      signal?.addEventListener('abort', () => controller.error(new DOMException('Aborted', 'AbortError')))
    },
  })
  return new Response(body, { status: 200, headers: { 'Content-Type': 'text/event-stream' } })
}

function harness(replies: Reply[], options: { tokens?: Array<string | null>; keepOpen?: boolean } = {}) {
  const controller = new AbortController()
  const log: string[] = []
  const requests: Array<{ url: string; authorization: string | null }> = []
  const tokens = options.tokens ?? ['jwt']
  let tokenIndex = 0
  const run = runLiveClient({
    url: '/api/v1/events',
    signal: controller.signal,
    getToken: () => tokens[Math.min(tokenIndex++, tokens.length - 1)],
    onStatus: (status) => log.push(`status:${status}`),
    onEvent: (event) => log.push(`event:${event.type}`),
    onUnauthorized: () => log.push('unauthorized'),
    fetch: async (input, init) => {
      requests.push({ url: String(input), authorization: new Headers(init?.headers).get('Authorization') })
      const reply = replies.shift()
      if (reply === undefined || reply instanceof Error) throw reply ?? new TypeError('Failed to fetch')
      if (typeof reply === 'number') return new Response(null, { status: reply })
      return sseResponse(reply, init?.signal, options.keepOpen ?? false)
    },
    wait: async (ms) => {
      log.push(`wait:${ms}`)
      if (replies.length === 0) controller.abort()
    },
  })
  return { run, log, requests, controller }
}

describe('runLiveClient', () => {
  it('sends the token in the Authorization header and delivers parsed events', async () => {
    const { run, log, requests } = harness([['event: agent.connected\ndata: {"agent":"probe","platform":"linux"}\n\n: keepalive\n\n']])
    await run

    expect(requests).toEqual([{ url: '/api/v1/events', authorization: 'Bearer jwt' }])
    expect(log).toEqual(['status:open', 'event:agent.connected', 'status:down', 'wait:1000'])
  })

  it('stops and reports unauthorized on a 401 without retrying', async () => {
    const { run, log, requests } = harness([401, []])
    await run

    expect(requests).toHaveLength(1)
    expect(log).toEqual(['unauthorized'])
  })

  it('reports unauthorized without a request when there is no token', async () => {
    const { run, log, requests } = harness([[]], { tokens: [null] })
    await run

    expect(requests).toEqual([])
    expect(log).toEqual(['unauthorized'])
  })

  it('reconnects with a growing backoff that resets after a successful connection', async () => {
    const { run, log, requests } = harness([new TypeError('Failed to fetch'), 502, [], new TypeError('Failed to fetch')], {
      tokens: ['jwt-1', 'jwt-2', 'jwt-3', 'jwt-4'],
    })
    await run

    expect(requests.map((request) => request.authorization)).toEqual(['Bearer jwt-1', 'Bearer jwt-2', 'Bearer jwt-3', 'Bearer jwt-4'])
    expect(log).toEqual([
      'status:down',
      'wait:1000',
      'status:down',
      'wait:2000',
      'status:open',
      'status:down',
      'wait:1000',
      'status:down',
      'wait:2000',
    ])
  })

  it('stops quietly when aborted while the stream is open', async () => {
    const { run, log, controller } = harness([['event: agent.disconnected\ndata: {"agent":"probe"}\n\n']], { keepOpen: true })
    await new Promise((resolve) => setTimeout(resolve, 10))
    controller.abort()
    await run

    expect(log).toEqual(['status:open', 'event:agent.disconnected'])
  })
})

describe('backoffDelay', () => {
  it('doubles from one second up to thirty seconds', () => {
    expect([0, 1, 2, 3, 4, 5, 6].map(backoffDelay)).toEqual([1000, 2000, 4000, 8000, 16000, 30000, 30000])
  })
})
