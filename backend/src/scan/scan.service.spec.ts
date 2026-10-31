import {
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { MoreThanOrEqual, Repository } from 'typeorm';
import { ApiKey } from '../entities/api-key.entity';
import { Device } from '../entities/device.entity';
import { EventsService } from '../events/events.service';
import { LiveEvent } from '../events/live-event';
import { ScanReport } from '../entities/scan-report.entity';
import { Subnet } from '../entities/subnet.entity';
import { hashApiKey } from '../lib/api-key';
import { ScanService } from './scan.service';

function makeDevice(overrides: Partial<Device> = {}): Device {
  return {
    id: 1,
    ip: '192.168.1.10',
    mac: '',
    hostname: '',
    vendor: '',
    subnetId: null,
    status: 'online',
    lastSeen: new Date(),
    notes: '',
    ...overrides,
  } as Device;
}

describe('ScanService', () => {
  let service: ScanService;
  let deviceRepo: {
    findOne: jest.Mock;
    save: jest.Mock;
    create: jest.Mock;
  };
  let subnetRepo: { find: jest.Mock };
  let apiKeyRepo: { findOne: jest.Mock; save: jest.Mock };
  let reportRepo: { create: jest.Mock; save: jest.Mock; find?: jest.Mock };
  let events: LiveEvent[];

  const validKey = 'ipam-0123456789abcdef0123456789abcdef';
  const keyRecord = {
    id: 1,
    name: 'test',
    keyHash: hashApiKey(validKey),
    keyPrefix: validKey.slice(0, 8),
    createdAt: new Date(),
    lastUsedAt: null,
  };

  beforeEach(async () => {
    let nextId = 100;
    deviceRepo = {
      findOne: jest.fn(),
      save: jest.fn(async (device: Device) => ({
        ...device,
        id: device.id ?? nextId++,
      })),
      create: jest.fn((options: Partial<Device>) => options as Device),
    };
    subnetRepo = {
      find: jest.fn(async () => [
        { id: 1, cidr: '192.168.1.0/24' } as Subnet,
        { id: 2, cidr: '10.0.0.0/24' } as Subnet,
      ]),
    };
    apiKeyRepo = {
      findOne: jest.fn(async () => ({ ...keyRecord })),
      save: jest.fn(async (key: ApiKey) => key),
    };
    reportRepo = {
      create: jest.fn(
        (options: Partial<ScanReport>) =>
          ({ id: 99, receivedAt: new Date(), ...options }) as ScanReport,
      ),
      save: jest.fn(async (report: ScanReport) => report),
    };

    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        ScanService,
        { provide: getRepositoryToken(Device), useValue: deviceRepo },
        { provide: getRepositoryToken(Subnet), useValue: subnetRepo },
        { provide: getRepositoryToken(ApiKey), useValue: apiKeyRepo },
        {
          provide: getRepositoryToken(ScanReport),
          useValue: reportRepo,
        },
        EventsService,
      ],
    }).compile();

    service = moduleRef.get(ScanService);
    events = [];
    moduleRef
      .get(EventsService)
      .stream()
      .subscribe((event) => events.push(event));
  });

  it('rejects a missing api key', async () => {
    await expect(
      service.receive(undefined, { agent: 'agent-1', devices: [] }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects an unknown api key', async () => {
    apiKeyRepo.findOne.mockResolvedValue(undefined);
    await expect(
      service.receive('ipam-unknown', { agent: 'agent-1', devices: [] }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(apiKeyRepo.findOne).toHaveBeenCalledWith({
      where: { keyHash: hashApiKey('ipam-unknown') },
    });
  });

  it('updates lastUsedAt on a valid key', async () => {
    await service.receive(validKey, { agent: 'agent-1', devices: [] });
    expect(apiKeyRepo.save).toHaveBeenCalledTimes(1);
    const saved = apiKeyRepo.save.mock.calls[0][0] as ApiKey;
    expect(saved.lastUsedAt).toBeInstanceOf(Date);
  });

  it('creates new devices with auto-assigned subnet', async () => {
    deviceRepo.findOne.mockResolvedValue(undefined);
    const result = await service.receive(validKey, {
      agent: 'agent-1',
      platform: 'linux',
      devices: [
        {
          ip: '192.168.1.50',
          mac: 'AA:BB:CC:DD:EE:01',
          hostname: 'host-1',
          vendor: 'Dell',
        },
      ],
    });
    expect(result).toEqual({ received: 1, created: 1, updated: 0, reportId: 99 });
    expect(deviceRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        ip: '192.168.1.50',
        mac: 'AA:BB:CC:DD:EE:01',
        hostname: 'host-1',
        vendor: 'Dell',
        subnetId: 1,
        status: 'online',
        notes: '',
      }),
    );
    expect(reportRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        agent: 'agent-1',
        platform: 'linux',
        deviceCount: 1,
      }),
    );
  });

  it('leaves subnet null when no cidr contains the ip', async () => {
    deviceRepo.findOne.mockResolvedValue(undefined);
    await service.receive(validKey, {
      agent: 'agent-1',
      devices: [{ ip: '172.31.0.5' }],
    });
    expect(deviceRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ subnetId: null, mac: '', hostname: '' }),
    );
  });

  it('updates existing devices without touching missing fields', async () => {
    const existing = makeDevice({
      id: 7,
      ip: '10.0.0.5',
      mac: 'old-mac',
      hostname: 'old-host',
      status: 'offline',
    });
    deviceRepo.findOne.mockResolvedValue(existing);
    const result = await service.receive(validKey, {
      agent: 'agent-1',
      devices: [{ ip: '10.0.0.5', mac: 'new-mac' }],
    });
    expect(result).toEqual({ received: 1, created: 0, updated: 1, reportId: 99 });
    expect(existing.mac).toBe('new-mac');
    expect(existing.hostname).toBe('old-host');
    expect(existing.status).toBe('online');
    expect(existing.lastSeen).toBeInstanceOf(Date);
    expect(deviceRepo.save).toHaveBeenCalledWith(existing);
    expect(deviceRepo.create).not.toHaveBeenCalled();
  });

  it('defaults platform to empty string', async () => {
    deviceRepo.findOne.mockResolvedValue(undefined);
    await service.receive(validKey, {
      agent: 'agent-1',
      devices: [{ ip: '192.168.1.50' }],
    });
    expect(reportRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ platform: '' }),
    );
  });

  it('rejects an invalid ip in devices', async () => {
    await expect(
      service.receive(validKey, {
        agent: 'agent-1',
        devices: [{ ip: '999.1.1.1' }],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('returns reports newest first with clamped limit', async () => {
    const find = jest.fn(async () => []);
    reportRepo.find = find;
    await service.listReports(999);
    expect(find).toHaveBeenCalledWith(
      expect.objectContaining({ take: 200 }),
    );
    await service.listReports(undefined);
    expect(find).toHaveBeenCalledWith(
      expect.objectContaining({ take: 50 }),
    );
    await service.listReports(Number.NaN);
    expect(find).toHaveBeenCalledWith(
      expect.objectContaining({ take: 50 }),
    );
  });

  it('stores on the report the subnets its devices were grouped under, without the devices outside every subnet', async () => {
    deviceRepo.findOne.mockImplementation(
      async ({ where }: { where: { ip: string } }) =>
        where.ip === '172.31.0.9'
          ? makeDevice({ id: 8, ip: '172.31.0.9', subnetId: null })
          : null,
    );

    await service.receive(validKey, {
      agent: 'agent-1',
      devices: [
        { ip: '10.0.0.5' },
        { ip: '192.168.1.50' },
        { ip: '10.0.0.6' },
        { ip: '172.31.0.9' },
      ],
    });

    expect(reportRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ deviceCount: 4, subnetIds: [2, 1] }),
    );
  });

  it('stores no subnets on a report without devices', async () => {
    await service.receive(validKey, { agent: 'agent-1', devices: [] });

    expect(reportRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ subnetIds: [] }),
    );
  });

  describe('listing reports of one subnet', () => {
    const report = (id: number, subnetIds: number[]) =>
      ({ id, agent: 'agent-1', platform: '', deviceCount: 1, receivedAt: new Date(), subnetIds }) as ScanReport;

    it('keeps only the reports that reached the subnet, up to the limit', async () => {
      const find = jest.fn(async () => [
        report(5, [1, 2]),
        report(4, [2]),
        report(3, [1]),
        report(2, []),
        report(1, [1]),
      ]);
      reportRepo.find = find;

      const reports = await service.listReports(2, { subnetId: 1 });

      expect(reports.map((entry) => entry.id)).toEqual([5, 3]);
      expect(find).toHaveBeenCalledWith(
        expect.not.objectContaining({ take: expect.anything() }),
      );
    });

    it('asks only for the reports received since a given time', async () => {
      const find = jest.fn(async () => []);
      reportRepo.find = find;
      const since = new Date('2026-10-31T00:00:00.000Z');

      await service.listReports(undefined, { since });

      expect(find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { receivedAt: MoreThanOrEqual(since) },
          take: 50,
        }),
      );
    });
  });

  describe('live events', () => {
    beforeEach(() => {
      jest.useFakeTimers({
        now: new Date('2026-10-31T10:00:00.000Z'),
        doNotFake: ['setImmediate', 'nextTick', 'queueMicrotask'],
      });
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('emits device.created for a new ip and one scan.report grouping both devices by subnet', async () => {
      deviceRepo.findOne.mockImplementation(
        async ({ where }: { where: { ip: string } }) =>
          where.ip === '192.168.1.10'
            ? makeDevice({ id: 7, ip: '192.168.1.10', subnetId: 1 })
            : null,
      );

      await service.receive(validKey, {
        agent: 'agent-1',
        devices: [{ ip: '192.168.1.10' }, { ip: '192.168.1.50' }],
      });

      expect(events).toEqual([
        {
          type: 'device.created',
          data: { deviceId: 100, ip: '192.168.1.50', subnetId: 1 },
        },
        {
          type: 'scan.report',
          data: {
            agent: 'agent-1',
            source: 'report',
            receivedAt: '2026-10-31T10:00:00.000Z',
            reportId: 99,
            subnets: [{ subnetId: 1, deviceIds: [7, 100] }],
          },
        },
      ]);
    });

    it('groups devices outside every subnet under a null subnet', async () => {
      deviceRepo.findOne.mockResolvedValue(null);

      await service.receive(validKey, {
        agent: 'agent-1',
        devices: [{ ip: '10.0.0.5' }, { ip: '172.31.0.5' }],
      });

      const report = events.find((event) => event.type === 'scan.report');
      expect(report?.data).toMatchObject({
        subnets: [
          { subnetId: 2, deviceIds: [100] },
          { subnetId: null, deviceIds: [101] },
        ],
      });
      expect(events.filter((event) => event.type === 'device.created')).toEqual([
        {
          type: 'device.created',
          data: { deviceId: 100, ip: '10.0.0.5', subnetId: 2 },
        },
        {
          type: 'device.created',
          data: { deviceId: 101, ip: '172.31.0.5', subnetId: null },
        },
      ]);
    });

    it('announces connector results as a connector scan without a report id', async () => {
      deviceRepo.findOne.mockResolvedValue(
        makeDevice({ id: 7, ip: '192.168.1.10', subnetId: 1 }),
      );

      const result = await service.receiveConnectorResult('probe', [
        { ip: '192.168.1.10' },
      ]);

      expect(result).toMatchObject({ created: 0, updated: 1 });
      expect(reportRepo.save).not.toHaveBeenCalled();
      expect(events).toEqual([
        {
          type: 'scan.report',
          data: {
            agent: 'probe',
            source: 'connector',
            receivedAt: '2026-10-31T10:00:00.000Z',
            subnets: [{ subnetId: 1, deviceIds: [7] }],
          },
        },
      ]);
    });

    it('groups a known device by its stored subnet and lists a repeated ip once', async () => {
      deviceRepo.findOne.mockResolvedValue(
        makeDevice({ id: 7, ip: '192.168.1.10', subnetId: null }),
      );

      await service.receive(validKey, {
        agent: 'agent-1',
        devices: [{ ip: '192.168.1.10' }, { ip: '192.168.1.10' }],
      });

      expect(events).toHaveLength(1);
      expect(events[0].data).toMatchObject({
        subnets: [{ subnetId: null, deviceIds: [7] }],
      });
    });

    it('announces an empty report with no subnets', async () => {
      await service.receive(validKey, { agent: 'agent-1', devices: [] });

      expect(events).toEqual([
        {
          type: 'scan.report',
          data: expect.objectContaining({ reportId: 99, subnets: [] }),
        },
      ]);
    });

    it('emits nothing when a report is rejected for an invalid ip', async () => {
      deviceRepo.findOne.mockResolvedValue(null);

      await expect(
        service.receive(validKey, {
          agent: 'agent-1',
          devices: [{ ip: '192.168.1.50' }, { ip: '999.1.1.1' }],
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(events).toEqual([]);
    });
  });
});
