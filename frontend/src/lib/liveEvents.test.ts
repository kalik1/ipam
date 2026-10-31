import { describe, expect, it } from 'vitest'
import { createLiveEventParser } from './liveEvents'

describe('createLiveEventParser', () => {
  it('turns an SSE frame into a typed live event', () => {
    const parse = createLiveEventParser()

    expect(parse('event: agent.connected\nid: 1\ndata: {"agent":"probe","platform":"linux"}\n\n')).toEqual([
      { type: 'agent.connected', data: { agent: 'probe', platform: 'linux' } },
    ])
  })

  it('joins multi-line data with newlines', () => {
    const parse = createLiveEventParser()

    expect(parse('event: agent.heartbeat\ndata: {"agent":"probe",\ndata:"at":"2026-10-31T10:00:00.000Z"}\n\n')).toEqual([
      { type: 'agent.heartbeat', data: { agent: 'probe', at: '2026-10-31T10:00:00.000Z' } },
    ])
  })

  it('assembles events split across chunks', () => {
    const parse = createLiveEventParser()
    const chunks = ['ev', 'ent: agent.connected\nda', 'ta: {"agent":"pro', 'be","platform":"linux"}\n', '\nevent: agent.disc', 'onnected\ndata: {"agent":"probe"}\n\n']

    expect(chunks.flatMap(parse)).toEqual([
      { type: 'agent.connected', data: { agent: 'probe', platform: 'linux' } },
      { type: 'agent.disconnected', data: { agent: 'probe' } },
    ])
  })

  it('accepts CRLF line endings even when a CRLF is split across chunks', () => {
    const parse = createLiveEventParser()
    const chunks = ['event: agent.heartbeat\r', '\ndata: {"agent":"probe",\r', '\ndata: "at":"2026-10-31T10:00:00.000Z"}\r\n\r', '\n']

    expect(chunks.flatMap(parse)).toEqual([
      { type: 'agent.heartbeat', data: { agent: 'probe', at: '2026-10-31T10:00:00.000Z' } },
    ])
  })

  it('decodes every event type of the live channel', () => {
    const parse = createLiveEventParser()
    const events = [
      {
        type: 'scan.report',
        data: { agent: 'probe', source: 'report', receivedAt: '2026-10-31T10:00:00.000Z', reportId: 7, subnets: [{ subnetId: null, deviceIds: [3] }] },
      },
      { type: 'device.created', data: { deviceId: 3, ip: '10.9.9.9', subnetId: null } },
      { type: 'device.offline', data: { deviceIds: [1, 2] } },
      { type: 'agent.connected', data: { agent: 'probe', platform: 'linux' } },
      { type: 'agent.disconnected', data: { agent: 'probe' } },
      { type: 'agent.heartbeat', data: { agent: 'probe', at: '2026-10-31T10:00:00.000Z' } },
      { type: 'command.sent', data: { commandId: 'c1', agent: 'probe', connector: 'mikrotik' } },
      { type: 'command.result', data: { commandId: 'c1', agent: 'probe', ok: false, error: 'timeout' } },
    ]
    const stream = events.map((event) => `event: ${event.type}\ndata: ${JSON.stringify(event.data)}\n\n`).join('')

    expect(parse(stream)).toEqual(events)
  })

  it('ignores unknown event types', () => {
    const parse = createLiveEventParser()

    expect(parse('event: agent.renamed\ndata: {"agent":"probe"}\n\ndata: {"agent":"probe"}\n\n')).toEqual([])
  })

  it('ignores events whose data is not valid JSON or lacks required fields', () => {
    const parse = createLiveEventParser()
    const frames = [
      'event: agent.connected\ndata: {"agent":"probe"\n\n',
      'event: agent.connected\ndata: ["probe","linux"]\n\n',
      'event: agent.connected\ndata: {"agent":"probe"}\n\n',
      'event: agent.heartbeat\ndata: {"agent":42,"at":"2026-10-31T10:00:00.000Z"}\n\n',
      'event: agent.disconnected\ndata: {"agent":"probe"}\n\n',
    ]

    expect(frames.flatMap(parse)).toEqual([{ type: 'agent.disconnected', data: { agent: 'probe' } }])
  })

  it('ignores comments such as keepalives', () => {
    const parse = createLiveEventParser()

    expect(parse(': keepalive\n\n')).toEqual([])
    expect(parse(': keepalive\nevent: agent.disconnected\n: note\ndata: {"agent":"probe"}\n\n')).toEqual([
      { type: 'agent.disconnected', data: { agent: 'probe' } },
    ])
  })
})
