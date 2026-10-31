import {
  Injectable,
  NotFoundException,
  OnApplicationBootstrap,
  OnApplicationShutdown,
} from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { InjectRepository } from '@nestjs/typeorm';
import type { Server } from 'node:http';
import { randomUUID } from 'node:crypto';
import { Repository } from 'typeorm';
import { WebSocket, WebSocketServer, type RawData } from 'ws';
import { hashApiKey } from '../lib/api-key';
import { ApiKey } from '../entities/api-key.entity';
import { EventsService } from '../events/events.service';
import { NetworkImportService } from '../network-import/network-import.service';
import { ScanService } from '../scan/scan.service';
import {
  AgentInbound,
  extractDevices,
  extractNetwork,
  HelloIn,
  parseInbound,
  ReportIn,
  ResultIn,
} from './agent-ws.protocol';
import { AgentCommandDto } from './agent-ws.dto';

const PING_INTERVAL_MS = 30_000;
const PING_TIMEOUT_MS = 90_000;
const RESULT_CACHE_LIMIT = 200;

export interface AgentInfo {
  name: string;
  platform: string;
  connectors: string[];
  connectedAt: Date;
  lastPingAt: Date;
}

export interface StoredResult {
  id: string;
  ok: boolean;
  data?: Record<string, unknown>;
  error?: string;
  receivedAt: Date;
}

export interface AgentSession {
  name: string;
  platform: string;
  connectors: string[];
  connectedAt: Date;
  lastPingAt: Date;
  socket: WebSocket;
  keyRecord: ApiKey;
}

@Injectable()
export class AgentWsService
  implements OnApplicationBootstrap, OnApplicationShutdown
{
  private readonly sessions = new Map<string, AgentSession>();
  private readonly latestResults = new Map<string, StoredResult>();
  private readonly resultsByCommandId = new Map<string, StoredResult>();
  private wss: WebSocketServer | undefined;
  private watchdog: NodeJS.Timeout | undefined;

  constructor(
    private readonly httpAdapterHost: HttpAdapterHost,
    @InjectRepository(ApiKey)
    private readonly apiKeyRepo: Repository<ApiKey>,
    private readonly scanService: ScanService,
    private readonly networkImport: NetworkImportService,
    private readonly events: EventsService,
  ) {}

  onApplicationBootstrap(): void {
    this.wss = new WebSocketServer({
      server: this.httpAdapterHost.httpAdapter.getHttpServer() as Server,
      path: '/ws/agent',
    });
    this.wss.on('connection', (socket) => this.handleConnection(socket));
    this.watchdog = setInterval(
      () => this.expireStaleSessions(),
      PING_INTERVAL_MS,
    );
  }

  onApplicationShutdown(): void {
    if (this.watchdog) clearInterval(this.watchdog);
    this.watchdog = undefined;
    this.wss?.close();
    this.wss = undefined;
  }

  async findApiKey(key: string): Promise<ApiKey | null> {
    return this.apiKeyRepo.findOne({ where: { keyHash: hashApiKey(key) } });
  }

  handleConnection(socket: WebSocket): void {
    socket.on('message', (data: RawData) => {
      const parsed = parseInbound(this.toText(data));
      if ('error' in parsed) {
        this.sendError(socket, parsed.error);
        return;
      }
      void this.dispatch(socket, parsed.message).catch((error: unknown) => {
        this.sendError(socket, describe(error));
      });
    });
    socket.on('close', () => this.handleDisconnect(socket));
  }

  listAgents(): AgentInfo[] {
    return [...this.sessions.values()].map((session) => ({
      name: session.name,
      platform: session.platform,
      connectors: session.connectors,
      connectedAt: session.connectedAt,
      lastPingAt: session.lastPingAt,
    }));
  }

  sendCommand(name: string, dto: AgentCommandDto): { id: string } {
    const session = this.sessions.get(name);
    if (!session) throw new NotFoundException('Agent not connected');
    const id = randomUUID();
    const command: Record<string, unknown> = {
      type: 'command',
      id,
      action: dto.action,
      connector: dto.connector,
    };
    if (dto.params !== undefined) command.params = dto.params;
    session.socket.send(JSON.stringify(command));
    return { id };
  }

  getLatestResult(name: string): StoredResult | undefined {
    return this.latestResults.get(name);
  }

  getResultById(commandId: string): StoredResult | undefined {
    return this.resultsByCommandId.get(commandId);
  }

  isConnected(name: string): boolean {
    return this.sessions.has(name);
  }

  expireStaleSessions(now = Date.now()): void {
    for (const [name, session] of this.sessions) {
      if (now - session.lastPingAt.getTime() > PING_TIMEOUT_MS) {
        this.sessions.delete(name);
        this.publishDisconnected(name);
        session.socket.close();
      }
    }
  }

  private async dispatch(
    socket: WebSocket,
    message: AgentInbound,
  ): Promise<void> {
    if (message.type === 'hello') {
      await this.handleHello(socket, message);
      return;
    }
    const session = this.sessionForSocket(socket);
    if (!session) {
      this.sendError(socket, 'not_authenticated');
      socket.close();
      return;
    }
    if (message.type === 'ping') {
      session.lastPingAt = new Date();
      this.sendJson(socket, { type: 'pong' });
      this.events.publish({
        type: 'agent.heartbeat',
        data: { agent: session.name, at: session.lastPingAt.toISOString() },
      });
      return;
    }
    if (message.type === 'report') {
      await this.handleReport(session, message);
      return;
    }
    await this.handleResult(session, message);
  }

  private async handleHello(
    socket: WebSocket,
    message: HelloIn,
  ): Promise<void> {
    const keyRecord = await this.findApiKey(message.apiKey);
    if (!keyRecord) {
      this.sendJson(socket, {
        type: 'hello_ack',
        ok: false,
        error: 'invalid_api_key',
      });
      socket.close();
      return;
    }
    const previous = this.sessions.get(message.agent);
    const now = new Date();
    this.sessions.set(message.agent, {
      name: message.agent,
      platform: message.platform,
      connectors: message.connectors,
      connectedAt: now,
      lastPingAt: now,
      socket,
      keyRecord,
    });
    if (previous && previous.socket !== socket) previous.socket.close();
    this.sendJson(socket, { type: 'hello_ack', ok: true });
    this.events.publish({
      type: 'agent.connected',
      data: { agent: message.agent, platform: message.platform },
    });
  }

  private async handleReport(
    session: AgentSession,
    message: ReportIn,
  ): Promise<void> {
    try {
      const result = await this.scanService.receiveForKey(
        session.keyRecord,
        session.name,
        message.platform,
        message.devices,
      );
      this.sendJson(session.socket, { type: 'report_ack', ...result });
    } catch (error) {
      this.sendError(session.socket, describe(error));
    }
  }

  private async handleResult(
    session: AgentSession,
    message: ResultIn,
  ): Promise<void> {
    const stored: StoredResult = {
      id: message.id,
      ok: message.ok,
      receivedAt: new Date(),
    };
    if (message.ok) stored.data = message.data;
    else stored.error = message.error;
    this.latestResults.set(session.name, stored);
    this.resultsByCommandId.set(stored.id, stored);
    if (this.resultsByCommandId.size > RESULT_CACHE_LIMIT) {
      const oldest = this.resultsByCommandId.keys().next().value;
      if (oldest !== undefined) this.resultsByCommandId.delete(oldest);
    }

    const devices = extractDevices(message.data);
    if (devices) {
      try {
        await this.scanService.receiveConnectorResult(session.name, devices);
      } catch (error) {
        this.sendError(session.socket, describe(error));
      }
    }
    const network = extractNetwork(message.data);
    if (network) {
      try {
        await this.networkImport.importNetwork(
          network.vlans,
          network.subnets,
          network.reservedIps,
          network.dhcpRanges,
        );
      } catch (error) {
        this.sendError(session.socket, describe(error));
      }
    }
  }

  private handleDisconnect(socket: WebSocket): void {
    for (const [name, session] of this.sessions) {
      if (session.socket !== socket) continue;
      this.sessions.delete(name);
      this.publishDisconnected(name);
    }
  }

  private publishDisconnected(agent: string): void {
    this.events.publish({ type: 'agent.disconnected', data: { agent } });
  }

  private sessionForSocket(socket: WebSocket): AgentSession | undefined {
    for (const session of this.sessions.values()) {
      if (session.socket === socket) return session;
    }
    return undefined;
  }

  private sendJson(socket: WebSocket, payload: unknown): void {
    if (socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(payload));
    }
  }

  private sendError(socket: WebSocket, message: string): void {
    this.sendJson(socket, { type: 'error', message });
  }

  private toText(data: RawData): string {
    if (typeof data === 'string') return data;
    if (Array.isArray(data)) return Buffer.concat(data).toString('utf8');
    if (data instanceof ArrayBuffer) {
      return Buffer.from(new Uint8Array(data)).toString('utf8');
    }
    return data.toString('utf8');
  }
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
