import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { SubnetsService } from './subnets.service';
import { Subnet } from '../entities/subnet.entity';
import { Vlan } from '../entities/vlan.entity';
import { Device } from '../entities/device.entity';
import { Gateway } from '../entities/gateway.entity';
import { DhcpPool } from '../entities/dhcp-pool.entity';

function makeSubnet(overrides: Partial<Subnet> = {}): Subnet {
  return {
    id: 1,
    cidr: '192.168.1.0/24',
    name: 'LAN',
    includeFirstLast: false,
    gateways: [],
    dhcpPools: [],
    vlanId: null,
    vlan: null,
    description: '',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as Subnet;
}

function makeGateway(overrides: Partial<Gateway> = {}): Gateway {
  return {
    id: 1,
    ip: '192.168.1.1',
    subnetId: 1,
    ...overrides,
  } as Gateway;
}

function makePool(overrides: Partial<DhcpPool> = {}): DhcpPool {
  return {
    id: 1,
    name: 'users',
    startIp: '192.168.1.100',
    endIp: '192.168.1.200',
    subnetId: 1,
    ...overrides,
  } as DhcpPool;
}

describe('SubnetsService', () => {
  let service: SubnetsService;
  let subnetFindOne: jest.Mock;
  let gatewaySave: jest.Mock;
  let gatewayDelete: jest.Mock;
  let poolSave: jest.Mock;
  let poolFind: jest.Mock;
  let poolFindOne: jest.Mock;
  let subnetSave: jest.Mock;
  let vlanFindOne: jest.Mock;

  beforeEach(async () => {
    subnetFindOne = jest.fn();
    gatewaySave = jest.fn(async (gateway: Gateway) => gateway);
    gatewayDelete = jest.fn(async () => undefined);
    poolSave = jest.fn(async (pool: DhcpPool) => pool);
    poolFind = jest.fn(async () => []);
    poolFindOne = jest.fn();
    subnetSave = jest.fn(async (subnet: Subnet) => subnet);
    vlanFindOne = jest.fn(async () => null);

    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        SubnetsService,
        {
          provide: getRepositoryToken(Subnet),
          useValue: {
            createQueryBuilder: jest.fn(),
            create: (data: Partial<Subnet>) => data,
            findOne: subnetFindOne,
            save: subnetSave,
            count: jest.fn(async () => 0),
            remove: jest.fn(async () => undefined),
          },
        },
        {
          provide: getRepositoryToken(Vlan),
          useValue: { findOne: vlanFindOne },
        },
        {
          provide: getRepositoryToken(Device),
          useValue: {
            find: jest.fn(async () => []),
            count: jest.fn(async () => 0),
          },
        },
        {
          provide: getRepositoryToken(Gateway),
          useValue: {
            create: (data: Partial<Gateway>) => data,
            save: gatewaySave,
            delete: gatewayDelete,
          },
        },
        {
          provide: getRepositoryToken(DhcpPool),
          useValue: {
            create: (data: Partial<DhcpPool>) => data,
            save: poolSave,
            delete: jest.fn(async () => undefined),
            find: poolFind,
            findOne: poolFindOne,
            remove: jest.fn(async () => undefined),
          },
        },
      ],
    }).compile();

    service = moduleRef.get(SubnetsService);
  });

  describe('create', () => {
    it('rejects an invalid cidr', async () => {
      await expect(
        service.create({ cidr: 'not-a-cidr', name: 'LAN' }),
      ).rejects.toThrow('Invalid CIDR');
    });

    it('rejects a gateway outside the subnet', async () => {
      await expect(
        service.create({
          cidr: '192.168.1.0/24',
          name: 'LAN',
          gateways: ['10.0.0.1'],
        }),
      ).rejects.toThrow('Gateway must be an IP inside the subnet');
    });

    it('rejects the network address when includeFirstLast is false', async () => {
      await expect(
        service.create({
          cidr: '192.168.1.0/24',
          name: 'LAN',
          gateways: ['192.168.1.0'],
        }),
      ).rejects.toThrow('Gateway must be a usable host IP in the subnet');
    });

    it('rejects duplicate gateways', async () => {
      await expect(
        service.create({
          cidr: '192.168.1.0/24',
          name: 'LAN',
          gateways: ['192.168.1.1', '192.168.1.1'],
        }),
      ).rejects.toThrow('Duplicate gateway');
    });

    it('rejects a pool with invalid ips', async () => {
      await expect(
        service.create({
          cidr: '192.168.1.0/24',
          name: 'LAN',
          dhcpPools: [{ startIp: 'bad', endIp: '192.168.1.10' }],
        }),
      ).rejects.toThrow('DHCP pool must use valid IPs');
    });

    it('rejects a pool outside the subnet', async () => {
      await expect(
        service.create({
          cidr: '192.168.1.0/24',
          name: 'LAN',
          dhcpPools: [{ startIp: '10.0.0.1', endIp: '10.0.0.10' }],
        }),
      ).rejects.toThrow('DHCP pool must be inside the subnet');
    });

    it('rejects a pool with startIp greater than endIp', async () => {
      await expect(
        service.create({
          cidr: '192.168.1.0/24',
          name: 'LAN',
          dhcpPools: [{ startIp: '192.168.1.200', endIp: '192.168.1.100' }],
        }),
      ).rejects.toThrow('DHCP pool startIp must be <= endIp');
    });

    it('rejects a pool touching the network address when includeFirstLast is false', async () => {
      await expect(
        service.create({
          cidr: '192.168.1.0/24',
          name: 'LAN',
          dhcpPools: [{ startIp: '192.168.1.0', endIp: '192.168.1.10' }],
        }),
      ).rejects.toThrow('DHCP pool must be within the usable range');
    });

    it('creates a subnet with gateways and pools', async () => {
      const loaded = makeSubnet({
        id: 7,
        gateways: [
          makeGateway({ id: 1, ip: '192.168.1.1' }),
          makeGateway({ id: 2, ip: '192.168.1.2' }),
        ],
        dhcpPools: [makePool()],
      });
      subnetFindOne.mockImplementation(
        async (opts: { where: { id?: number; cidr?: string } }) =>
          opts.where.cidr !== undefined ? null : loaded,
      );

      const result = await service.create({
        cidr: '192.168.1.0/24',
        name: 'LAN',
        gateways: ['192.168.1.1', '192.168.1.2'],
        dhcpPools: [
          { name: 'users', startIp: '192.168.1.100', endIp: '192.168.1.200' },
        ],
      });

      expect(gatewaySave).toHaveBeenCalledTimes(2);
      expect(poolSave).toHaveBeenCalledTimes(1);
      expect(result.gateways).toEqual(['192.168.1.1', '192.168.1.2']);
      expect(result.dhcpPools).toHaveLength(1);
    });

    it('allows network and broadcast addresses when includeFirstLast is true', async () => {
      const loaded = makeSubnet({
        id: 7,
        cidr: '10.0.0.0/30',
        includeFirstLast: true,
        gateways: [
          makeGateway({ id: 1, ip: '10.0.0.0' }),
          makeGateway({ id: 2, ip: '10.0.0.3' }),
        ],
      });
      subnetFindOne.mockImplementation(
        async (opts: { where: { id?: number; cidr?: string } }) =>
          opts.where.cidr !== undefined ? null : loaded,
      );

      const result = await service.create({
        cidr: '10.0.0.0/30',
        name: 'P2P',
        includeFirstLast: true,
        gateways: ['10.0.0.0', '10.0.0.3'],
      });

      expect(result.gateways).toEqual(['10.0.0.0', '10.0.0.3']);
    });
  });

  describe('update', () => {
    it('returns 404 for an unknown subnet', async () => {
      subnetFindOne.mockResolvedValue(null);
      await expect(service.update(99, { name: 'X' })).rejects.toThrow(
        NotFoundException,
      );
    });

    it('replaces gateways when the update provides them', async () => {
      const loaded = makeSubnet({
        gateways: [
          makeGateway({ id: 1, ip: '192.168.1.1' }),
          makeGateway({ id: 2, ip: '192.168.1.2' }),
        ],
      });
      subnetFindOne.mockResolvedValue(loaded);

      const result = await service.update(1, {
        gateways: ['192.168.1.1', '192.168.1.2'],
      });

      expect(gatewayDelete).toHaveBeenCalledWith({ subnetId: 1 });
      expect(gatewaySave).toHaveBeenCalledTimes(2);
      expect(result.gateways).toEqual(['192.168.1.1', '192.168.1.2']);
    });

    it('replaces pools when the update provides them', async () => {
      subnetFindOne.mockResolvedValue(makeSubnet());

      const result = await service.update(1, {
        dhcpPools: [
          { name: 'users', startIp: '192.168.1.100', endIp: '192.168.1.200' },
        ],
      });

      expect(poolSave).toHaveBeenCalledTimes(1);
      expect(result.dhcpPools).toHaveLength(0);
    });

    it('moves the subnet to another VLAN even when the old VLAN relation is loaded', async () => {
      const users = { id: 1, vlanId: 20, name: 'Users' } as Vlan;
      const servers = { id: 2, vlanId: 30, name: 'Servers' } as Vlan;
      subnetFindOne.mockResolvedValue(makeSubnet({ vlanId: 1, vlan: users }));
      vlanFindOne.mockResolvedValue(servers);

      await service.update(1, { vlanId: 2 });

      expect(subnetSave).toHaveBeenCalledWith(
        expect.objectContaining({ vlanId: 2, vlan: servers }),
      );
    });

    it('clears the VLAN when the update sends null', async () => {
      const users = { id: 1, vlanId: 20, name: 'Users' } as Vlan;
      subnetFindOne.mockResolvedValue(makeSubnet({ vlanId: 1, vlan: users }));

      await service.update(1, { vlanId: null });

      expect(subnetSave).toHaveBeenCalledWith(
        expect.objectContaining({ vlanId: null, vlan: null }),
      );
    });

    it('rejects an unknown VLAN id', async () => {
      subnetFindOne.mockResolvedValue(makeSubnet());
      await expect(service.update(1, { vlanId: 99 })).rejects.toThrow(
        'VLAN not found',
      );
    });
  });

  describe('pool endpoints', () => {
    it('lists pools for a subnet', async () => {
      subnetFindOne.mockResolvedValue(makeSubnet());
      poolFind.mockResolvedValue([makePool()]);

      const pools = await service.findPools(1);
      expect(pools).toEqual([
        {
          id: 1,
          name: 'users',
          startIp: '192.168.1.100',
          endIp: '192.168.1.200',
        },
      ]);
    });

    it('returns 404 for pools of an unknown subnet', async () => {
      subnetFindOne.mockResolvedValue(null);
      await expect(service.findPools(99)).rejects.toThrow(NotFoundException);
    });

    it('creates a pool validated against the subnet', async () => {
      subnetFindOne.mockResolvedValue(makeSubnet());
      poolSave.mockImplementation(async (pool: DhcpPool) => ({
        ...pool,
        id: 5,
      }));

      const pool = await service.createPool(1, {
        name: 'users',
        startIp: '192.168.1.100',
        endIp: '192.168.1.200',
      });
      expect(pool.id).toBe(5);

      await expect(
        service.createPool(1, {
          startIp: '192.168.1.0',
          endIp: '192.168.1.10',
        }),
      ).rejects.toThrow('DHCP pool must be within the usable range');
    });

    it('updates a pool with merged fields', async () => {
      poolFindOne.mockResolvedValue(makePool());
      subnetFindOne.mockResolvedValue(makeSubnet());
      poolSave.mockImplementation(async (pool: DhcpPool) => pool);

      const updated = await service.updatePool(1, {
        endIp: '192.168.1.250',
      });
      expect(updated.startIp).toBe('192.168.1.100');
      expect(updated.endIp).toBe('192.168.1.250');
    });

    it('returns 404 for an unknown pool', async () => {
      poolFindOne.mockResolvedValue(null);
      await expect(service.updatePool(99, { name: 'x' })).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.deletePool(99)).rejects.toThrow(NotFoundException);
    });
  });
});
