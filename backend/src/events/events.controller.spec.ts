import { INestApplication } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { SSE_KEEPALIVE_MS } from './events.controller';
import { EventsModule } from './events.module';
import { EventsService } from './events.service';

interface OpenStream {
  status: number;
  contentType: string | undefined;
  readUntil(text: string): Promise<string>;
  close(): void;
}

function openStream(port: number, token?: string): Promise<OpenStream> {
  return new Promise((resolve, reject) => {
    const headers: Record<string, string> = token
      ? { Authorization: `Bearer ${token}` }
      : {};
    const request = http.get(
      { host: '127.0.0.1', port, path: '/events', headers },
      (response) => {
        let received = '';
        const waiters: Array<() => void> = [];
        response.setEncoding('utf8');
        response.on('data', (chunk: string) => {
          received += chunk;
          waiters.splice(0).forEach((wake) => wake());
        });
        resolve({
          status: response.statusCode ?? 0,
          contentType: response.headers['content-type'],
          readUntil: (text) =>
            new Promise((done) => {
              const check = () => {
                if (received.includes(text)) done(received);
                else waiters.push(check);
              };
              check();
            }),
          close: () => request.destroy(),
        });
      },
    );
    request.on('error', (error) => {
      if (!request.destroyed) reject(error);
    });
  });
}

describe('GET /events', () => {
  let app: INestApplication;
  let port: number;
  let events: EventsService;
  let token: string;
  const streams: OpenStream[] = [];

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        JwtModule.register({ global: true, secret: 'test-secret' }),
        EventsModule,
      ],
      providers: [{ provide: APP_GUARD, useClass: JwtAuthGuard }],
    })
      .overrideProvider(SSE_KEEPALIVE_MS)
      .useValue(30)
      .compile();
    app = moduleRef.createNestApplication({ logger: false });
    await app.listen(0, '127.0.0.1');
    port = (app.getHttpServer().address() as AddressInfo).port;
    events = moduleRef.get(EventsService);
    token = moduleRef.get(JwtService).sign({ sub: 1, username: 'admin' });
  });

  afterEach(async () => {
    streams.splice(0).forEach((stream) => stream.close());
    await app.close();
  });

  async function open(withToken?: string): Promise<OpenStream> {
    const stream = await openStream(port, withToken);
    streams.push(stream);
    return stream;
  }

  it('rejects a request without a token', async () => {
    const stream = await open();

    expect(stream.status).toBe(401);
  });

  it('rejects a request with an invalid token', async () => {
    const stream = await open('not-a-jwt');

    expect(stream.status).toBe(401);
  });

  it('opens an event stream that receives comment keepalives', async () => {
    const stream = await open(token);

    expect(stream.status).toBe(200);
    expect(stream.contentType).toContain('text/event-stream');
    await expect(stream.readUntil(': keepalive\n\n')).resolves.toContain(
      ': keepalive\n\n',
    );
  });

  it('writes published events in SSE format', async () => {
    const stream = await open(token);
    events.publish({
      type: 'agent.heartbeat',
      data: { agent: 'probe', at: '2026-10-31T10:00:00.000Z' },
    });

    const frame =
      'event: agent.heartbeat\n' +
      'id: 1\n' +
      'data: {"agent":"probe","at":"2026-10-31T10:00:00.000Z"}\n\n';
    await expect(stream.readUntil(frame)).resolves.toContain(frame);
  });
});
