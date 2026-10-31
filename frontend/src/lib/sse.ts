export interface SseFrame {
  event: string
  data: string
}

const LINE_BREAK = /\r\n|\r|\n/

export function createSseParser(): (chunk: string) => SseFrame[] {
  let buffer = ''
  let event = ''
  let data: string[] = []

  function dispatch(frames: SseFrame[]) {
    if (data.length > 0) frames.push({ event: event || 'message', data: data.join('\n') })
    event = ''
    data = []
  }

  function readField(line: string) {
    const colon = line.indexOf(':')
    const field = colon === -1 ? line : line.slice(0, colon)
    const raw = colon === -1 ? '' : line.slice(colon + 1)
    const value = raw.startsWith(' ') ? raw.slice(1) : raw
    if (field === 'event') event = value
    else if (field === 'data') data.push(value)
  }

  return (chunk) => {
    const text = buffer + chunk
    const end = text.endsWith('\r') ? text.length - 1 : text.length
    const lines = text.slice(0, end).split(LINE_BREAK)
    buffer = (lines.pop() ?? '') + text.slice(end)
    const frames: SseFrame[] = []
    for (const line of lines) {
      if (line === '') dispatch(frames)
      else if (!line.startsWith(':')) readField(line)
    }
    return frames
  }
}
