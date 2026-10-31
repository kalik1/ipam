import { describe, expect, it } from 'vitest'
import type { LiveEvent } from './liveEvents'
import { INITIAL_LIVE_STATE, blinkClass, brandLedClass, liveReducer, type LiveAction, type LiveState } from './liveState'

function run(actions: LiveAction[], state: LiveState = INITIAL_LIVE_STATE): LiveState {
  return actions.reduce(liveReducer, state)
}

function event(value: LiveEvent): LiveAction {
  return { kind: 'event', event: value }
}

describe('liveReducer', () => {
  it('starts connecting, with no agents and no events', () => {
    expect(INITIAL_LIVE_STATE).toEqual({ link: 'connecting', received: 0, agents: [], agentsLoaded: false })
  })

  it('follows the connection state of the live channel', () => {
    const opened = run([{ kind: 'link', status: 'open' }])
    const dropped = run([{ kind: 'link', status: 'down' }], opened)
    const reopened = run([{ kind: 'link', status: 'open' }], dropped)

    expect([opened.link, dropped.link, reopened.link]).toEqual(['open', 'down', 'open'])
  })

  it('adds a connected agent with no heartbeats yet', () => {
    const state = run([event({ type: 'agent.connected', data: { agent: 'probe', platform: 'linux' } })])

    expect(state.agents).toEqual([{ name: 'probe', platform: 'linux', connected: true, heartbeats: 0 }])
  })

  it('counts heartbeats only on the agent that sent them', () => {
    const state = run([
      event({ type: 'agent.connected', data: { agent: 'alpha', platform: 'linux' } }),
      event({ type: 'agent.connected', data: { agent: 'beta', platform: 'windows' } }),
      event({ type: 'agent.heartbeat', data: { agent: 'beta', at: '2026-10-31T10:00:00.000Z' } }),
      event({ type: 'agent.heartbeat', data: { agent: 'beta', at: '2026-10-31T10:00:30.000Z' } }),
    ])

    expect(state.agents).toEqual([
      { name: 'alpha', platform: 'linux', connected: true, heartbeats: 0 },
      { name: 'beta', platform: 'windows', connected: true, heartbeats: 2 },
    ])
  })

  it('marks only the disconnected agent as disconnected', () => {
    const state = run([
      event({ type: 'agent.connected', data: { agent: 'alpha', platform: 'linux' } }),
      event({ type: 'agent.connected', data: { agent: 'beta', platform: 'windows' } }),
      event({ type: 'agent.heartbeat', data: { agent: 'alpha', at: '2026-10-31T10:00:00.000Z' } }),
      event({ type: 'agent.disconnected', data: { agent: 'alpha' } }),
    ])

    expect(state.agents).toEqual([
      { name: 'alpha', platform: 'linux', connected: false, heartbeats: 1 },
      { name: 'beta', platform: 'windows', connected: true, heartbeats: 0 },
    ])
  })

  it('ignores a disconnection of an agent it never saw', () => {
    const state = run([event({ type: 'agent.disconnected', data: { agent: 'ghost' } })])

    expect(state.agents).toEqual([])
  })

  it('brings a disconnected agent back when it connects again', () => {
    const state = run([
      event({ type: 'agent.connected', data: { agent: 'probe', platform: 'linux' } }),
      event({ type: 'agent.heartbeat', data: { agent: 'probe', at: '2026-10-31T10:00:00.000Z' } }),
      event({ type: 'agent.disconnected', data: { agent: 'probe' } }),
      event({ type: 'agent.connected', data: { agent: 'probe', platform: 'android' } }),
    ])

    expect(state.agents).toEqual([{ name: 'probe', platform: 'android', connected: true, heartbeats: 1 }])
  })

  it('counts every received event, including the ones that change no agent', () => {
    const state = run([
      { kind: 'link', status: 'open' },
      event({ type: 'agent.connected', data: { agent: 'probe', platform: 'linux' } }),
      event({ type: 'device.offline', data: { deviceIds: [4] } }),
      event({ type: 'command.sent', data: { commandId: 'c1', agent: 'probe', connector: 'mikrotik' } }),
      event({ type: 'command.result', data: { commandId: 'c1', agent: 'probe', ok: true } }),
      event({ type: 'device.created', data: { deviceId: 9, ip: '10.0.0.9', subnetId: 1 } }),
      event({
        type: 'scan.report',
        data: { agent: 'probe', source: 'connector', receivedAt: '2026-10-31T10:00:00.000Z', subnets: [{ subnetId: 1, deviceIds: [9] }] },
      }),
    ])

    expect(state.received).toBe(6)
    expect(state.agents).toEqual([{ name: 'probe', platform: 'linux', connected: true, heartbeats: 0 }])
  })

  it('takes the connected agents from a snapshot and marks the missing ones disconnected', () => {
    const state = run([
      event({ type: 'agent.connected', data: { agent: 'gone', platform: 'linux' } }),
      event({ type: 'agent.connected', data: { agent: 'kept', platform: 'linux' } }),
      event({ type: 'agent.heartbeat', data: { agent: 'kept', at: '2026-10-31T10:00:00.000Z' } }),
      {
        kind: 'agents',
        agents: [
          { name: 'kept', platform: 'linux' },
          { name: 'fresh', platform: 'ios' },
        ],
      },
    ])

    expect(state.agentsLoaded).toBe(true)
    expect(state.received).toBe(3)
    expect(state.agents).toEqual([
      { name: 'fresh', platform: 'ios', connected: true, heartbeats: 0 },
      { name: 'gone', platform: 'linux', connected: false, heartbeats: 0 },
      { name: 'kept', platform: 'linux', connected: true, heartbeats: 1 },
    ])
  })

  it('treats a heartbeat from an unseen agent as proof it is connected', () => {
    const state = run([event({ type: 'agent.heartbeat', data: { agent: 'probe', at: '2026-10-31T10:00:00.000Z' } })])

    expect(state.agents).toEqual([{ name: 'probe', platform: '', connected: true, heartbeats: 1 }])
  })
})

describe('blinkClass', () => {
  it('does not blink before the first event', () => {
    expect(blinkClass(0, 'hb')).toBeUndefined()
  })

  it('alternates between two classes so each event restarts the animation', () => {
    expect([1, 2, 3, 4].map((count) => blinkClass(count, 'hb'))).toEqual(['hb-a', 'hb-b', 'hb-a', 'hb-b'])
  })
})

describe('brandLedClass', () => {
  it('is unlit while connecting, steady while open and red while down', () => {
    expect(brandLedClass({ link: 'connecting', received: 0 })).toBe('brand-led')
    expect(brandLedClass({ link: 'open', received: 0 })).toBe('brand-led on')
    expect(brandLedClass({ link: 'down', received: 0 })).toBe('brand-led err')
  })

  it('blinks on each received event and keeps the last blink class when the link drops', () => {
    expect(brandLedClass({ link: 'open', received: 1 })).toBe('brand-led on ev-a')
    expect(brandLedClass({ link: 'open', received: 2 })).toBe('brand-led on ev-b')
    expect(brandLedClass({ link: 'down', received: 2 })).toBe('brand-led err ev-b')
  })
})
