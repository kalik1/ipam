import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Device } from '../entities/device.entity';
import { Subnet } from '../entities/subnet.entity';
import { Vlan } from '../entities/vlan.entity';
import { TopologyService } from './topology.service';

function makeVlan(overrides: Partial<Vlan> = {}): Vlan {
  return {
    id: 1,
    vlanId: 10,
    name: 'LAN',
    description: '',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as Vlan;
}

function makeSubnet(overrides: Partial<Subnet> = {}): Subnet {
  return {
    id: 1,
    cidr: '192.168.1.0/24',
    name: 'LAN',
    includeFirstLast: false,
    gateways: [{ id: 1, ip: '192.168.1.1', subnetId: 1 }],
    vlanId: 1,
    description: '',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as Subnet;
}

function makeDevice(overrides: Partial<Device> = {}): Device {
  return {
    id: 1,
    ip: '192.168.1.10',
    mac: '',
    hostname: 'host-1',
    vendor: '',
    subnetId: 1,
    status: 'online',
    lastSeen: new Date(),
    notes: '',
    ...overrides,
  } as Device;
}

describe('TopologyService', () => {
  let service: TopologyService;
  let vlanRepo: { find: jest.Mock };
  let subnetRepo: { find: jest.Mock };
  let deviceRepo: { find: jest.Mock };

  beforeEach(async () => {
    vlanRepo = { find: jest.fn(async () => [makeVlan()]) };
    subnetRepo = { find: jest.fn(async () => [makeSubnet()]) };
    deviceRepo = { find: jest.fn(async () => [makeDevice()]) };

    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        TopologyService,
        { provide: getRepositoryToken(Vlan), useValue: vlanRepo },
        { provide: getRepositoryToken(Subnet), useValue: subnetRepo },
        { provide: getRepositoryToken(Device), useValue: deviceRepo },
      ],
    }).compile();

    service = moduleRef.get(TopologyService);
  });

  it('groups subnets and devices under their vlan', async () => {
    vlanRepo.find.mockResolvedValue([
      makeVlan({ id: 1, vlanId: 10, name: 'LAN' }),
      makeVlan({ id: 2, vlanId: 20, name: 'WAN' }),
    ]);
    subnetRepo.find.mockResolvedValue([
      makeSubnet({ id: 1, cidr: '192.168.1.0/24', vlanId: 1 }),
      makeSubnet({ id: 2, cidr: '10.0.0.0/30', vlanId: 2 }),
    ]);
    deviceRepo.find.mockResolvedValue([
      makeDevice({ id: 1, ip: '192.168.1.10', subnetId: 1 }),
      makeDevice({ id: 2, ip: '10.0.0.1', subnetId: 2 }),
    ]);

    const result = await service.getTopology();
    expect(result).toEqual({
      vlans: [
        {
          id: 1,
          vlanId: 10,
          name: 'LAN',
          description: '',
          subnets: [
            {
              id: 1,
              cidr: '192.168.1.0/24',
              name: 'LAN',
              gateways: ['192.168.1.1'],
              used: 1,
              total: 254,
              percent: 0.4,
              devices: [
                {
                  id: 1,
                  ip: '192.168.1.10',
                  hostname: 'host-1',
                  status: 'online',
                  lastSeen: expect.any(Date),
                },
              ],
            },
          ],
        },
        {
          id: 2,
          vlanId: 20,
          name: 'WAN',
          description: '',
          subnets: [
            {
              id: 2,
              cidr: '10.0.0.0/30',
              name: 'LAN',
              gateways: ['192.168.1.1'],
              used: 1,
              total: 2,
              percent: 50,
              devices: [
                {
                  id: 2,
                  ip: '10.0.0.1',
                  hostname: 'host-1',
                  status: 'online',
                  lastSeen: expect.any(Date),
                },
              ],
            },
          ],
        },
      ],
    });
  });

  it('adds an Unassigned pseudo-entry for subnets without a vlan', async () => {
    subnetRepo.find.mockResolvedValue([
      makeSubnet({ id: 1, vlanId: 1 }),
      makeSubnet({ id: 3, cidr: '172.16.0.0/24', vlanId: null }),
    ]);
    deviceRepo.find.mockResolvedValue([
      makeDevice({ id: 1, subnetId: 1 }),
      makeDevice({ id: 3, ip: '172.16.0.5', subnetId: 3 }),
    ]);

    const result = await service.getTopology();
    expect(result.vlans).toHaveLength(2);
    expect(result.vlans[1]).toEqual({
      id: null,
      vlanId: null,
      name: 'Unassigned',
      description: '',
      subnets: [
        {
          id: 3,
          cidr: '172.16.0.0/24',
          name: 'LAN',
          gateways: ['192.168.1.1'],
          used: 1,
          total: 254,
          percent: 0.4,
          devices: [
            {
              id: 3,
              ip: '172.16.0.5',
              hostname: 'host-1',
              status: 'online',
              lastSeen: expect.any(Date),
            },
          ],
        },
      ],
    });
  });

  it('omits the Unassigned pseudo-entry when all subnets have a vlan', async () => {
    const result = await service.getTopology();
    expect(result.vlans).toHaveLength(1);
    expect(result.vlans[0].name).not.toBe('Unassigned');
  });

  it('excludes devices without a subnet from the topology', async () => {
    deviceRepo.find.mockResolvedValue([
      makeDevice({ id: 1, subnetId: 1 }),
      makeDevice({ id: 4, ip: '8.8.8.8', subnetId: null }),
    ]);

    const result = await service.getTopology();
    expect(result.vlans[0].subnets[0].devices).toHaveLength(1);
    expect(result.vlans[0].subnets[0].used).toBe(1);
  });

  it('reports percent 0 when the subnet has no usable hosts', async () => {
    subnetRepo.find.mockResolvedValue([
      makeSubnet({ id: 1, cidr: '192.168.1.5/32' }),
    ]);
    deviceRepo.find.mockResolvedValue([makeDevice({ subnetId: 1 })]);

    const result = await service.getTopology();
    expect(result.vlans[0].subnets[0]).toMatchObject({
      used: 1,
      total: 0,
      percent: 0,
    });
  });

  it('sorts gateways numerically', async () => {
    subnetRepo.find.mockResolvedValue([
      makeSubnet({
        gateways: [
          { id: 1, ip: '192.168.1.10', subnetId: 1 },
          { id: 2, ip: '192.168.1.2', subnetId: 1 },
        ],
      }),
    ]);

    const result = await service.getTopology();
    expect(result.vlans[0].subnets[0].gateways).toEqual([
      '192.168.1.2',
      '192.168.1.10',
    ]);
  });

  it('counts all hosts when includeFirstLast is true', async () => {
    subnetRepo.find.mockResolvedValue([
      makeSubnet({ id: 1, cidr: '10.0.0.0/30', includeFirstLast: true }),
    ]);
    deviceRepo.find.mockResolvedValue([
      makeDevice({ id: 1, ip: '10.0.0.0', subnetId: 1 }),
      makeDevice({ id: 2, ip: '10.0.0.3', subnetId: 1 }),
    ]);

    const result = await service.getTopology();
    expect(result.vlans[0].subnets[0]).toMatchObject({
      used: 2,
      total: 4,
      percent: 50,
    });
  });

  it('returns an empty list when there is no data', async () => {
    vlanRepo.find.mockResolvedValue([]);
    subnetRepo.find.mockResolvedValue([]);
    deviceRepo.find.mockResolvedValue([]);

    const result = await service.getTopology();
    expect(result).toEqual({ vlans: [] });
  });
});
