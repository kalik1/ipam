import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DevicesService } from './devices.service';
import { Device } from '../entities/device.entity';
import { Subnet } from '../entities/subnet.entity';

function makeDevice(overrides: Partial<Device> = {}): Device {
  return {
    id: 1,
    ip: '192.168.1.10',
    mac: '',
    hostname: 'box',
    vendor: '',
    subnetId: null,
    subnet: null,
    status: 'online',
    lastSeen: new Date(),
    notes: '',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe('DevicesService', () => {
  let service: DevicesService;
  let deviceFindOne: jest.Mock;
  let deviceSave: jest.Mock;
  let subnetFindOne: jest.Mock;

  beforeEach(async () => {
    deviceFindOne = jest.fn();
    deviceSave = jest.fn((device: Device) => Promise.resolve(device));
    subnetFindOne = jest.fn(() => Promise.resolve(null));

    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        DevicesService,
        {
          provide: getRepositoryToken(Device),
          useValue: { findOne: deviceFindOne, save: deviceSave },
        },
        {
          provide: getRepositoryToken(Subnet),
          useValue: { findOne: subnetFindOne, find: jest.fn() },
        },
      ],
    }).compile();

    service = moduleRef.get(DevicesService);
  });

  describe('update', () => {
    it('moves the device to another subnet even when the old subnet relation is loaded', async () => {
      const users = { id: 1, cidr: '192.168.1.0/24' } as Subnet;
      const servers = { id: 2, cidr: '172.16.0.0/16' } as Subnet;
      deviceFindOne.mockResolvedValue(
        makeDevice({ subnetId: 1, subnet: users }),
      );
      subnetFindOne.mockResolvedValue(servers);

      await service.update(1, { subnetId: 2 });

      expect(deviceSave).toHaveBeenCalledWith(
        expect.objectContaining({ subnetId: 2, subnet: servers }),
      );
    });

    it('clears the subnet when the update sends null', async () => {
      const users = { id: 1, cidr: '192.168.1.0/24' } as Subnet;
      deviceFindOne.mockResolvedValue(
        makeDevice({ subnetId: 1, subnet: users }),
      );

      await service.update(1, { subnetId: null });

      expect(deviceSave).toHaveBeenCalledWith(
        expect.objectContaining({ subnetId: null, subnet: null }),
      );
    });

    it('rejects an unknown subnet id', async () => {
      deviceFindOne.mockResolvedValue(makeDevice());
      await expect(service.update(1, { subnetId: 99 })).rejects.toThrow(
        'Subnet not found',
      );
    });
  });
});
