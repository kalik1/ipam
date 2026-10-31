import { describe, expect, it } from 'vitest'
import type { LiveEvent } from './liveEvents'
import {
  INITIAL_LIVE_STATE,
  RECENT_SCANS_LIMIT,
  blinkClass,
  isScanning,
  sweepClass,
  brandLedClass,
  devicePulseClass,
  liveReducer,
  pulseClass,
  type LiveAction,
  type LiveState,
} from './liveState'

function run(actions: LiveAction[], state: LiveState = INITIAL_LIVE_STATE): LiveState {
  return actions.reduce(liveReducer, state)
}

function event(value: LiveEvent): LiveAction {
  return { kind: 'event', event: value }
}

describe('liveReducer', () => {
  it('starts connecting, with no agents and no events', () => {
    expect(INITIAL_LIVE_STATE).toMatchObject({ link: 'connecting', received: 0, agents: [], agentsLoaded: false })
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

function scanReport(subnets: { subnetId: number | null; deviceIds: number[] }[], agent = 'probe'): LiveAction {
  return event({ type: 'scan.report', data: { agent, source: 'report', receivedAt: '2026-10-31T10:00:00.000Z', reportId: 1, subnets } })
}

function animated(state: LiveState) {
  return {
    sweeps: activeKeys(state, state.sweeps),
    flashes: activeKeys(state, state.flashes),
    plugs: activeKeys(state, state.plugs),
    fades: activeKeys(state, state.fades),
  }
}

function activeKeys(state: LiveState, pulses: LiveState['sweeps']): number[] {
  return Object.keys(pulses)
    .map(Number)
    .filter((key) => pulseClass(pulses[key], state.settled, 'x') !== undefined)
}

const NOTHING = { sweeps: [], flashes: [], plugs: [], fades: [] }

describe('live animation state', () => {
  it('has no animation state without an event', () => {
    const state = run([
      { kind: 'link', status: 'open' },
      { kind: 'agents', agents: [{ name: 'probe', platform: 'linux' }] },
      event({ type: 'agent.connected', data: { agent: 'probe', platform: 'linux' } }),
      event({ type: 'agent.heartbeat', data: { agent: 'probe', at: '2026-10-31T10:00:00.000Z' } }),
      event({ type: 'agent.disconnected', data: { agent: 'probe' } }),
    ])

    expect(animated(INITIAL_LIVE_STATE)).toEqual(NOTHING)
    expect(animated(state)).toEqual(NOTHING)
  })

  it('gives a scan report a single pass over the listed subnets and flashes exactly the listed devices', () => {
    const state = run([
      scanReport([
        { subnetId: 1, deviceIds: [7, 100] },
        { subnetId: 3, deviceIds: [12] },
        { subnetId: null, deviceIds: [40] },
      ]),
    ])

    expect(animated(state)).toEqual({ sweeps: [1, 3], flashes: [7, 12, 40, 100], plugs: [], fades: [] })
    expect(pulseClass(state.sweeps[1], state.settled, 'pass')).toBe('pass-a')
    expect(pulseClass(state.flashes[7], state.settled, 'seen')).toBe('seen-a')
  })

  it('restarts the pass of a subnet on its next scan report, even with other events in between', () => {
    const first = run([scanReport([{ subnetId: 1, deviceIds: [7] }])])
    const second = run(
      [
        event({ type: 'agent.heartbeat', data: { agent: 'probe', at: '2026-10-31T10:00:00.000Z' } }),
        scanReport([{ subnetId: 2, deviceIds: [9] }]),
        scanReport([{ subnetId: 1, deviceIds: [8] }]),
      ],
      first,
    )

    expect(pulseClass(second.sweeps[1], second.settled, 'pass')).toBe('pass-b')
    expect(pulseClass(second.sweeps[2], second.settled, 'pass')).toBe('pass-a')
    expect(pulseClass(second.flashes[7], second.settled, 'seen')).toBe('seen-a')
    expect(pulseClass(second.flashes[8], second.settled, 'seen')).toBe('seen-a')
  })

  it('plugs in a created device and fades exactly the devices that went offline', () => {
    const state = run([
      event({ type: 'device.created', data: { deviceId: 9, ip: '10.0.0.9', subnetId: 1 } }),
      event({ type: 'device.offline', data: { deviceIds: [3, 4] } }),
    ])

    expect(animated(state)).toEqual({ sweeps: [], flashes: [], plugs: [9], fades: [3, 4] })
  })

  it('settles the animations of an event and the ones before it, without counting as an event', () => {
    const state = run([
      scanReport([{ subnetId: 1, deviceIds: [7] }]),
      event({ type: 'device.created', data: { deviceId: 9, ip: '10.0.0.9', subnetId: 2 } }),
      { kind: 'settle', seq: 1 },
    ])

    expect(state.received).toBe(2)
    expect(animated(state)).toEqual({ sweeps: [], flashes: [], plugs: [9], fades: [] })
    expect(animated(run([{ kind: 'settle', seq: 2 }], state))).toEqual(NOTHING)
  })

  it('keeps alternating the classes of a key after its animation settled', () => {
    const state = run([
      scanReport([{ subnetId: 1, deviceIds: [7] }]),
      { kind: 'settle', seq: 1 },
      scanReport([{ subnetId: 1, deviceIds: [7] }]),
    ])

    expect(pulseClass(state.sweeps[1], state.settled, 'pass')).toBe('pass-b')
    expect(pulseClass(state.flashes[7], state.settled, 'seen')).toBe('seen-b')
  })
})

describe('recent scan reports', () => {
  it('keeps the received scan reports newest first, up to a limit', () => {
    const agents = Array.from({ length: RECENT_SCANS_LIMIT + 2 }, (_, index) => `agent-${index}`)
    const state = run(agents.map((agent) => scanReport([{ subnetId: 1, deviceIds: [7] }], agent)))

    expect(state.scans).toHaveLength(RECENT_SCANS_LIMIT)
    expect(state.scans[0].agent).toBe(`agent-${RECENT_SCANS_LIMIT + 1}`)
    expect(state.scans[RECENT_SCANS_LIMIT - 1].agent).toBe('agent-2')
  })
})

describe('any subnet sweep', () => {
  it('does not pulse before a scan report reaches a subnet', () => {
    const state = run([
      event({ type: 'device.created', data: { deviceId: 9, ip: '10.0.0.9', subnetId: 1 } }),
      scanReport([{ subnetId: null, deviceIds: [40] }]),
      scanReport([]),
    ])

    expect(pulseClass(INITIAL_LIVE_STATE.anySweep, INITIAL_LIVE_STATE.settled, 'rx')).toBeUndefined()
    expect(pulseClass(state.anySweep, state.settled, 'rx')).toBeUndefined()
  })

  it('pulses once per scan report that reaches any subnet, however many subnets it lists', () => {
    const first = run([
      scanReport([
        { subnetId: 1, deviceIds: [7] },
        { subnetId: 2, deviceIds: [8] },
      ]),
    ])
    const second = run([scanReport([{ subnetId: 3, deviceIds: [9] }])], first)

    expect(pulseClass(first.anySweep, first.settled, 'rx')).toBe('rx-a')
    expect(pulseClass(second.anySweep, second.settled, 'rx')).toBe('rx-b')
    expect(pulseClass(run([{ kind: 'settle', seq: 2 }], second).anySweep, 2, 'rx')).toBeUndefined()
  })
})

describe('devicePulseClass', () => {
  it('names every running animation of a device and nothing for a quiet one', () => {
    const state = run([
      event({ type: 'device.created', data: { deviceId: 9, ip: '10.0.0.9', subnetId: 1 } }),
      scanReport([{ subnetId: 1, deviceIds: [9] }]),
      event({ type: 'device.offline', data: { deviceIds: [4] } }),
    ])

    expect(devicePulseClass(state, 9)).toBe('seen-a new-a')
    expect(devicePulseClass(state, 4)).toBe('fade-a')
    expect(devicePulseClass(state, 5)).toBeUndefined()
    expect(devicePulseClass(run([{ kind: 'settle', seq: 3 }], state), 9)).toBeUndefined()
  })
})

function sent(commandId: string, agent = 'probe', connector = 'demo'): LiveAction {
  return event({ type: 'command.sent', data: { commandId, agent, connector } })
}

function result(commandId: string, agent = 'probe', error?: string): LiveAction {
  return event({
    type: 'command.result',
    data: error === undefined ? { commandId, agent, ok: true } : { commandId, agent, ok: false, error },
  })
}

describe('pending commands', () => {
  it('loops the sweep over every subnet map from a sent command until its result', () => {
    const scanning = run([sent('c1')])
    const done = run([result('c1')], scanning)

    expect(isScanning(scanning)).toBe(true)
    expect(scanning.pending).toEqual({ c1: { agent: 'probe', connector: 'demo' } })
    expect([sweepClass(scanning, 1), sweepClass(scanning, 2)]).toEqual(['loop', 'loop'])
    expect(isScanning(done)).toBe(false)
    expect(sweepClass(done, 1)).toBeUndefined()
  })

  it('keeps scanning until the result of every sent command arrived', () => {
    const two = run([sent('c1', 'alpha', 'demo'), sent('c2', 'beta', 'mikrotik')])
    const one = run([result('c2', 'beta')], two)
    const none = run([result('c1', 'alpha')], one)

    expect(two.pending).toEqual({ c1: { agent: 'alpha', connector: 'demo' }, c2: { agent: 'beta', connector: 'mikrotik' } })
    expect(one.pending).toEqual({ c1: { agent: 'alpha', connector: 'demo' } })
    expect(isScanning(one)).toBe(true)
    expect(isScanning(none)).toBe(false)
  })

  it('ignores a result for a command it never saw sent', () => {
    const state = run([sent('c1'), result('other')])

    expect(state.pending).toEqual({ c1: { agent: 'probe', connector: 'demo' } })
    expect(state.received).toBe(2)
  })

  it('gives the scan report of a result its single pass once no command is pending', () => {
    const state = run([sent('c1'), result('c1'), scanReport([{ subnetId: 1, deviceIds: [7] }])])
    const stillScanning = run([sent('c1'), sent('c2'), result('c1'), scanReport([{ subnetId: 1, deviceIds: [7] }])])

    expect(sweepClass(state, 1)).toBe('pass-a')
    expect(sweepClass(state, 2)).toBeUndefined()
    expect(sweepClass(stillScanning, 1)).toBe('loop')
    expect(devicePulseClass(stillScanning, 7)).toBe('seen-a')
  })

  it('stops waiting for the commands of an agent that disconnected', () => {
    const state = run([
      sent('c1', 'alpha'),
      sent('c2', 'beta'),
      event({ type: 'agent.disconnected', data: { agent: 'alpha' } }),
    ])

    expect(state.pending).toEqual({ c2: { agent: 'beta', connector: 'demo' } })
  })

  it('stops waiting for every command when the live channel drops, since their results may be missed', () => {
    const state = run([{ kind: 'link', status: 'open' }, sent('c1'), sent('c2'), { kind: 'link', status: 'down' }])

    expect(isScanning(state)).toBe(false)
  })
})

describe('failed commands', () => {
  it('keeps the error of a failed result with the connector it ran, newest first', () => {
    const state = run([
      sent('c1', 'probe', 'mikrotik'),
      sent('c2', 'probe', 'demo'),
      sent('c3', 'edge', 'mikrotik'),
      result('c1', 'probe', 'connect ECONNREFUSED'),
      result('c2', 'probe'),
      result('c3', 'edge', 'timeout'),
    ])

    expect(state.failures).toEqual([
      { commandId: 'c3', agent: 'edge', connector: 'mikrotik', error: 'timeout', seq: 6 },
      { commandId: 'c1', agent: 'probe', connector: 'mikrotik', error: 'connect ECONNREFUSED', seq: 4 },
    ])
  })

  it('ignores a failed result for a command it never saw sent', () => {
    expect(run([result('other', 'probe', 'boom')]).failures).toEqual([])
  })

  it('forgets the error of a connector when that connector runs again on the same agent', () => {
    const state = run([
      sent('c1', 'probe', 'mikrotik'),
      sent('c2', 'edge', 'mikrotik'),
      result('c1', 'probe', 'connect ECONNREFUSED'),
      result('c2', 'edge', 'timeout'),
      sent('c3', 'probe', 'mikrotik'),
    ])

    expect(state.failures.map((failure) => failure.commandId)).toEqual(['c2'])
  })
})
