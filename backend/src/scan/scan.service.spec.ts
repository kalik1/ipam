import {
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ApiKey } from '../entities/api-key.entity';
import { Device } from '../entities/device.entity';
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
  let reportRepo: { create: jest.Mock; save: jest.Mock };

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
    deviceRepo = {
      findOne: jest.fn(),
      save: jest.fn(async (device: Device) => device),
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
      ],
    }).compile();

    service = moduleRef.get(ScanService);
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
});
