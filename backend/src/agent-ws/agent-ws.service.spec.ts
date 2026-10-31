import { EventEmitter } from 'node:events';
import { HttpAdapterHost } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { WebSocket } from 'ws';
import { ApiKey } from '../entities/api-key.entity';
import { EventsService } from '../events/events.service';
import { LiveEvent } from '../events/live-event';
import { hashApiKey } from '../lib/api-key';
import { NetworkImportService } from '../network-import/network-import.service';
import { ScanService } from '../scan/scan.service';
import { AgentWsService } from './agent-ws.service';

const VALID_KEY = 'ipam-0123456789abcdef0123456789abcdef';

class FakeSocket extends EventEmitter {
  readyState: number = WebSocket.OPEN;
  readonly sent: unknown[] = [];

  send(data: string): void {
    this.sent.push(JSON.parse(data));
  }

  close(): void {
    if (this.readyState === WebSocket.CLOSED) return;
    this.readyState = WebSocket.CLOSED;
    this.emit('close');
  }

  receive(message: unknown): void {
    this.emit('message', Buffer.from(JSON.stringify(message)));
  }
}

function flush(): Promise<void> {
  return new Promise((resolve) => setImmediate(resolve));
}

describe('AgentWsService live events', () => {
  let service: AgentWsService;
  let events: LiveEvent[];

  beforeEach(async () => {
    const keyRecord = { id: 1, name: 'test', keyHash: hashApiKey(VALID_KEY) };
    const apiKeyRepo = {
      findOne: jest.fn(async (options: { where: { keyHash: string } }) =>
        options.where.keyHash === keyRecord.keyHash ? keyRecord : null,
      ),
    };
    const moduleRef = await Test.createTestingModule({
      providers: [
        AgentWsService,
        EventsService,
        { provide: HttpAdapterHost, useValue: {} },
        { provide: getRepositoryToken(ApiKey), useValue: apiKeyRepo },
        { provide: ScanService, useValue: {} },
        { provide: NetworkImportService, useValue: {} },
      ],
    }).compile();
    service = moduleRef.get(AgentWsService);
    events = [];
    moduleRef
      .get(EventsService)
      .stream()
      .subscribe((event) => events.push(event));
  });

  async function connect(
    agent = 'probe',
    apiKey = VALID_KEY,
  ): Promise<FakeSocket> {
    const socket = new FakeSocket();
    service.handleConnection(socket as unknown as WebSocket);
    socket.receive({
      type: 'hello',
      agent,
      platform: 'linux',
      apiKey,
      connectors: [],
    });
    await flush();
    return socket;
  }

  it('emits agent.connected on a valid hello', async () => {
    await connect();

    expect(events).toEqual([
      { type: 'agent.connected', data: { agent: 'probe', platform: 'linux' } },
    ]);
  });

  it('emits nothing for a hello with an invalid key', async () => {
    const socket = await connect('probe', 'ipam-wrong');

    expect(socket.sent).toEqual([
      { type: 'hello_ack', ok: false, error: 'invalid_api_key' },
    ]);
    expect(events).toEqual([]);
  });

  it('emits agent.heartbeat with the ping time on each ping', async () => {
    const socket = await connect();
    jest.useFakeTimers({
      now: new Date('2026-10-31T10:00:00.000Z'),
      doNotFake: ['setImmediate', 'nextTick', 'queueMicrotask'],
    });
    try {
      socket.receive({ type: 'ping' });
      await flush();
      jest.setSystemTime(new Date('2026-10-31T10:00:30.000Z'));
      socket.receive({ type: 'ping' });
      await flush();
    } finally {
      jest.useRealTimers();
    }

    expect(events.slice(1)).toEqual([
      {
        type: 'agent.heartbeat',
        data: { agent: 'probe', at: '2026-10-31T10:00:00.000Z' },
      },
      {
        type: 'agent.heartbeat',
        data: { agent: 'probe', at: '2026-10-31T10:00:30.000Z' },
      },
    ]);
  });

  it('emits agent.disconnected when the socket of a session closes', async () => {
    const socket = await connect();
    socket.close();

    expect(events.slice(1)).toEqual([
      { type: 'agent.disconnected', data: { agent: 'probe' } },
    ]);
    expect(service.isConnected('probe')).toBe(false);
  });

  it('emits nothing when a socket without a session closes', async () => {
    const socket = await connect('probe', 'ipam-wrong');
    socket.close();

    expect(events).toEqual([]);
  });

  it('does not report a disconnect when a new hello replaces the session', async () => {
    const first = await connect();
    const second = await connect();

    expect(first.readyState).toBe(WebSocket.CLOSED);
    expect(second.readyState).toBe(WebSocket.OPEN);
    expect(events.map((event) => event.type)).toEqual([
      'agent.connected',
      'agent.connected',
    ]);
    expect(service.isConnected('probe')).toBe(true);
  });

  it('emits agent.disconnected once when the watchdog expires a silent session', async () => {
    const socket = await connect();
    const lastPing = Date.now();

    service.expireStaleSessions(lastPing + 89_000);
    expect(events).toHaveLength(1);

    service.expireStaleSessions(lastPing + 91_000);
    expect(socket.readyState).toBe(WebSocket.CLOSED);
    expect(events.slice(1)).toEqual([
      { type: 'agent.disconnected', data: { agent: 'probe' } },
    ]);
  });

  it('emits no heartbeat for a ping before hello', async () => {
    const socket = new FakeSocket();
    service.handleConnection(socket as unknown as WebSocket);
    socket.receive({ type: 'ping' });
    await flush();

    expect(events).toEqual([]);
  });
});
