import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AgentWsService, StoredResult } from '../agent-ws/agent-ws.service';
import { AgentConnector } from '../entities/agent-connector.entity';
import { Connector } from '../entities/connector.entity';
import { ConnectorService } from './connector.service';

function makeConnector(overrides: Partial<Connector> = {}): Connector {
  return {
    id: 1,
    name: 'mikrotik',
    label: 'MikroTik',
    config: { host: '192.168.1.1', port: 8728 },
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as Connector;
}

function makeAssignment(overrides: Partial<AgentConnector> = {}): AgentConnector {
  return {
    id: 1,
    agentName: 'agent-1',
    connectorId: 1,
    connector: makeConnector(),
    schedule: '*/5 * * * *',
    enabled: true,
    lastRunAt: null,
    lastStatus: null,
    lastError: null,
    nextRunAt: new Date(Date.now() - 1000),
    commandRef: null,
    ...overrides,
  } as AgentConnector;
}

interface Repos {
  connectorFindOne: jest.Mock;
  connectorSave: jest.Mock;
  assignmentFindOne: jest.Mock;
  assignmentFind: jest.Mock;
  assignmentSave: jest.Mock;
  agentWs: {
    sendCommand: jest.Mock;
    getResultById: jest.Mock;
    getLatestResult: jest.Mock;
    listAgents: jest.Mock;
    isConnected: jest.Mock;
  };
}

async function buildModule(
  repoOverrides: Partial<{
    connectorFindOne: jest.Mock;
    connectorSave: jest.Mock;
    assignmentFindOne: jest.Mock;
    assignmentFind: jest.Mock;
    assignmentSave: jest.Mock;
  }>,
  agentWsOverrides: Partial<Repos['agentWs']> = {},
): Promise<{ module: TestingModule; repos: Repos }> {
  const connectorFindOne =
    repoOverrides.connectorFindOne ??
    jest.fn(async () => makeConnector());
  const connectorSave =
    repoOverrides.connectorSave ?? jest.fn(async (c: Connector) => c);
  const assignmentFindOne =
    repoOverrides.assignmentFindOne ??
    jest.fn(async () => makeAssignment());
  const assignmentFind =
    repoOverrides.assignmentFind ?? jest.fn(async () => []);
  const assignmentSave =
    repoOverrides.assignmentSave ??
    jest.fn(async (a: AgentConnector) => a);
  const agentWs: Repos['agentWs'] = {
    sendCommand: jest.fn(() => ({ id: 'cmd-1' })),
    getResultById: jest.fn(() => undefined),
    getLatestResult: jest.fn(() => undefined),
    listAgents: jest.fn(() => []),
    isConnected: jest.fn(() => true),
    ...agentWsOverrides,
  };
  const module = await Test.createTestingModule({
    providers: [
      ConnectorService,
      {
        provide: getRepositoryToken(Connector),
        useValue: {
          create: (data: Partial<Connector>) => data,
          findOne: connectorFindOne,
          save: connectorSave,
          find: jest.fn(async () => [makeConnector()]),
          remove: jest.fn(async () => undefined),
        },
      },
      {
        provide: getRepositoryToken(AgentConnector),
        useValue: {
          create: (data: Partial<AgentConnector>) => data,
          findOne: assignmentFindOne,
          find: assignmentFind,
          save: assignmentSave,
          remove: jest.fn(async () => undefined),
        },
      },
      { provide: AgentWsService, useValue: agentWs },
    ],
  }).compile();
  return {
    module,
    repos: {
      connectorFindOne,
      connectorSave,
      assignmentFindOne,
      assignmentFind,
      assignmentSave,
      agentWs,
    },
  };
}

describe('ConnectorService', () => {
  describe('cron validation and nextDate', () => {
    it('accepts a valid 5-field expression and returns a future date', async () => {
      const { module, repos } = await buildModule({
        assignmentFindOne: jest.fn(async () => null),
      });
      const service = module.get(ConnectorService);
      const date = service.nextDate('*/5 * * * *');
      expect(date).toBeInstanceOf(Date);
      expect(date.getTime()).toBeGreaterThan(Date.now());
      await expect(
        service.assign('agent-1', {
          connectorId: 1,
          schedule: '*/5 * * * *',
        }),
      ).resolves.toMatchObject({ agentName: 'agent-1' });
      expect(repos.assignmentSave).toHaveBeenCalled();
      await module.close();
    });

    it('rejects an invalid expression with 400', async () => {
      const { module } = await buildModule({});
      const service = module.get(ConnectorService);
      await expect(
        service.assign('agent-1', { connectorId: 1, schedule: 'bad' }),
      ).rejects.toThrow(BadRequestException);
      await module.close();
    });

    it('nextDate for a noon schedule is in the future', async () => {
      const { module } = await buildModule({});
      const service = module.get(ConnectorService);
      const date = service.nextDate('0 12 * * *');
      expect(date.getTime()).toBeGreaterThan(Date.now());
      await module.close();
    });
  });

  describe('assign', () => {
    it('throws 404 when the connector is missing', async () => {
      const { module } = await buildModule({
        connectorFindOne: jest.fn(async () => null),
      });
      const service = module.get(ConnectorService);
      await expect(
        service.assign('agent-1', { connectorId: 99, schedule: '* * * * *' }),
      ).rejects.toThrow(NotFoundException);
      await module.close();
    });

    it('throws 400 for an invalid schedule', async () => {
      const { module } = await buildModule({});
      const service = module.get(ConnectorService);
      await expect(
        service.assign('agent-1', { connectorId: 1, schedule: 'not-a-cron' }),
      ).rejects.toThrow(BadRequestException);
      await module.close();
    });

    it('throws 409 when the assignment already exists', async () => {
      const { module } = await buildModule({
        assignmentFindOne: jest.fn(async () => makeAssignment()),
      });
      const service = module.get(ConnectorService);
      await expect(
        service.assign('agent-1', { connectorId: 1, schedule: '*/5 * * * *' }),
      ).rejects.toThrow(ConflictException);
      await module.close();
    });

    it('creates the assignment with nextRunAt set', async () => {
      const { module, repos } = await buildModule({
        assignmentFindOne: jest.fn(async () => null),
      });
      const service = module.get(ConnectorService);
      const before = Date.now();
      const result = await service.assign('agent-1', {
        connectorId: 1,
        schedule: '*/5 * * * *',
      });
      expect(result.nextRunAt).toBeInstanceOf(Date);
      expect(result.nextRunAt!.getTime()).toBeGreaterThanOrEqual(before);
      expect(result.connector).toBeInstanceOf(Object);
      expect(repos.assignmentSave).toHaveBeenCalled();
      await module.close();
    });
  });

  describe('move', () => {
    it('throws 404 when the assignment is missing', async () => {
      const { module } = await buildModule({
        assignmentFindOne: jest.fn(async () => null),
      });
      const service = module.get(ConnectorService);
      await expect(
        service.moveAssignment('agent-1', 1, 'agent-2'),
      ).rejects.toThrow(NotFoundException);
      await module.close();
    });

    it('throws 409 when the target agent already has the connector', async () => {
      const { module } = await buildModule({
        assignmentFindOne: jest.fn(async (opts: { where: object }) =>
          opts.where.agentName === 'agent-2'
            ? makeAssignment({ agentName: 'agent-2' })
            : makeAssignment(),
        ),
      });
      const service = module.get(ConnectorService);
      await expect(
        service.moveAssignment('agent-1', 1, 'agent-2'),
      ).rejects.toThrow(ConflictException);
      await module.close();
    });

    it('reassigns to the target agent and recomputes nextRunAt', async () => {
      const { module, repos } = await buildModule({
        assignmentFindOne: jest.fn(async (opts: { where: object }) =>
          opts.where.agentName === 'agent-2' ? null : makeAssignment(),
        ),
      });
      const service = module.get(ConnectorService);
      const before = Date.now();
      const result = await service.moveAssignment('agent-1', 1, 'agent-2');
      expect(result.agentName).toBe('agent-2');
      expect(result.nextRunAt!.getTime()).toBeGreaterThanOrEqual(before);
      expect(repos.assignmentSave).toHaveBeenCalledWith(result);
      await module.close();
    });
  });

  describe('tick', () => {
    it('sends the command and marks sent when the agent is connected', async () => {
      const assignment = makeAssignment({
        nextRunAt: new Date(Date.now() - 1000),
        lastStatus: null,
      });
      const { module, repos } = await buildModule(
        {
          assignmentFind: jest.fn(async (opts: { where: object }) =>
            'enabled' in opts.where ? [assignment] : [],
          ),
        },
        { sendCommand: jest.fn(() => ({ id: 'cmd-42' })) },
      );
      const service = module.get(ConnectorService);
      await service.tick();
      expect(repos.agentWs.sendCommand).toHaveBeenCalledWith('agent-1', {
        action: 'run_connector',
        connector: 'mikrotik',
        params: { host: '192.168.1.1', port: 8728 },
      });
      expect(assignment.lastStatus).toBe('sent');
      expect(assignment.commandRef).toBe('cmd-42');
      expect(assignment.lastRunAt).toBeInstanceOf(Date);
      expect(assignment.lastError).toBeNull();
      expect(assignment.nextRunAt!.getTime()).toBeGreaterThan(Date.now());
      await module.close();
    });

    it('marks skipped when the agent is not connected', async () => {
      const assignment = makeAssignment({
        nextRunAt: new Date(Date.now() - 1000),
        lastStatus: null,
      });
      const { module, repos } = await buildModule(
        {
          assignmentFind: jest.fn(async (opts: { where: object }) =>
            'enabled' in opts.where ? [assignment] : [],
          ),
        },
        {
          sendCommand: jest.fn(() => {
            throw new NotFoundException('Agent not connected');
          }),
        },
      );
      const service = module.get(ConnectorService);
      await service.tick();
      expect(assignment.lastStatus).toBe('skipped');
      expect(assignment.lastError).toBe('agent not connected');
      expect(assignment.commandRef).toBeNull();
      expect(assignment.nextRunAt!.getTime()).toBeGreaterThan(Date.now());
      await module.close();
    });

    it('resolves pending sent results from the agent ws service', async () => {
      const pending = makeAssignment({
        lastStatus: 'sent',
        commandRef: 'cmd-7',
        nextRunAt: new Date(Date.now() + 60_000),
      });
      const okResult: StoredResult = {
        id: 'cmd-7',
        ok: true,
        receivedAt: new Date(),
      };
      const { module } = await buildModule(
        {
          assignmentFind: jest.fn(async (opts: { where: object }) =>
            'enabled' in opts.where
              ? []
              : [pending],
          ),
        },
        { getResultById: jest.fn(() => okResult) },
      );
      const service = module.get(ConnectorService);
      await service.tick();
      expect(pending.lastStatus).toBe('ok');
      expect(pending.lastError).toBeNull();
      await module.close();
    });

    it('marks error when the result reports a failure', async () => {
      const pending = makeAssignment({
        lastStatus: 'sent',
        commandRef: 'cmd-8',
        nextRunAt: new Date(Date.now() + 60_000),
      });
      const errorResult: StoredResult = {
        id: 'cmd-8',
        ok: false,
        error: 'connection refused',
        receivedAt: new Date(),
      };
      const { module } = await buildModule(
        {
          assignmentFind: jest.fn(async (opts: { where: object }) =>
            'enabled' in opts.where ? [] : [pending],
          ),
        },
        { getResultById: jest.fn(() => errorResult) },
      );
      const service = module.get(ConnectorService);
      await service.tick();
      expect(pending.lastStatus).toBe('error');
      expect(pending.lastError).toBe('connection refused');
      await module.close();
    });
  });
});
