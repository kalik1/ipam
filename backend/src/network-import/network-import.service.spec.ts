import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Device } from '../entities/device.entity';
import { DhcpPool } from '../entities/dhcp-pool.entity';
import { EventsService } from '../events/events.service';
import { LiveEvent } from '../events/live-event';
import { Gateway } from '../entities/gateway.entity';
import { Subnet } from '../entities/subnet.entity';
import { Vlan } from '../entities/vlan.entity';
import { NetworkImportService } from './network-import.service';

function makeDevice(overrides: Partial<Device> = {}): Device {
  return {
    id: 1,
    ip: '192.168.220.50',
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

describe('NetworkImportService', () => {
  let service: NetworkImportService;
  let vlanRepo: { findOne: jest.Mock; save: jest.Mock; create: jest.Mock };
  let subnetRepo: {
    findOne: jest.Mock;
    save: jest.Mock;
    create: jest.Mock;
    find: jest.Mock;
  };
  let gatewayRepo: { find: jest.Mock; save: jest.Mock; create: jest.Mock };
  let deviceRepo: {
    find: jest.Mock;
    findOne: jest.Mock;
    save: jest.Mock;
    create: jest.Mock;
  };
  let poolRepo: { find: jest.Mock; save: jest.Mock; create: jest.Mock };
  let events: LiveEvent[];

  beforeEach(async () => {
    vlanRepo = {
      findOne: jest.fn(async () => null),
      save: jest.fn(async (vlan: Vlan) => vlan),
      create: jest.fn((options: Partial<Vlan>) => options as Vlan),
    };
    subnetRepo = {
      findOne: jest.fn(async () => null),
      save: jest.fn(async (subnet: Subnet) => subnet),
      create: jest.fn((options: Partial<Subnet>) => options as Subnet),
      find: jest.fn(async () => []),
    };
    gatewayRepo = {
      find: jest.fn(async () => []),
      save: jest.fn(async (gateway: Gateway) => gateway),
      create: jest.fn((options: Partial<Gateway>) => options as Gateway),
    };
    deviceRepo = {
      find: jest.fn(async () => []),
      findOne: jest.fn(async () => null),
      save: jest.fn(async (device: Device) => device),
      create: jest.fn((options: Partial<Device>) => options as Device),
    };
    poolRepo = {
      find: jest.fn(async () => []),
      save: jest.fn(async (pool: DhcpPool) => pool),
      create: jest.fn((options: Partial<DhcpPool>) => options as DhcpPool),
    };

    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        NetworkImportService,
        { provide: getRepositoryToken(Vlan), useValue: vlanRepo },
        { provide: getRepositoryToken(Subnet), useValue: subnetRepo },
        { provide: getRepositoryToken(Gateway), useValue: gatewayRepo },
        { provide: getRepositoryToken(Device), useValue: deviceRepo },
        { provide: getRepositoryToken(DhcpPool), useValue: poolRepo },
        EventsService,
      ],
    }).compile();

    service = moduleRef.get(NetworkImportService);
    events = [];
    moduleRef
      .get(EventsService)
      .stream()
      .subscribe((event) => events.push(event));
  });

  it('creates missing vlans and skips existing ones', async () => {
    vlanRepo.findOne.mockImplementation(async ({ where }: { where: { vlanId: number } }) =>
      where.vlanId === 220 ? { id: 1, vlanId: 220, name: 'existing' } : null,
    );
    const result = await service.importNetwork(
      [
        { vlanId: 220, name: 'should-not-overwrite' },
        { vlanId: 5, name: 'vlan-5' },
      ],
      [],
    );
    expect(result.vlansCreated).toBe(1);
    expect(vlanRepo.create).toHaveBeenCalledWith({
      vlanId: 5,
      name: 'vlan-5',
      description: '',
    });
  });

  it('ignores vlan ids outside the 0-4095 range', async () => {
    const result = await service.importNetwork(
      [
        { vlanId: 9999, name: 'too-big' },
        { vlanId: -1, name: 'negative' },
      ],
      [],
    );
    expect(result.vlansCreated).toBe(0);
    expect(vlanRepo.create).not.toHaveBeenCalled();
  });

  it('creates a missing subnet with its gateway and resolves the vlan primary key', async () => {
    subnetRepo.save.mockImplementation(async (subnet: Subnet) => ({
      id: 42,
      ...subnet,
    }));
    vlanRepo.findOne.mockImplementation(async ({ where }: { where: { vlanId: number } }) =>
      where.vlanId === 220 ? { id: 7, vlanId: 220 } : null,
    );
    const result = await service.importNetwork(
      [],
      [{ cidr: '192.168.220.0/24', name: 'bridge220', gateway: '192.168.220.1', vlanId: 220 }],
    );
    expect(result.subnetsCreated).toBe(1);
    expect(result.gatewaysAdded).toBe(1);
    expect(subnetRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ cidr: '192.168.220.0/24', vlanId: 7 }),
    );
    expect(gatewayRepo.create).toHaveBeenCalledWith({ ip: '192.168.220.1', subnetId: 42 });
  });

  it('leaves the subnet vlan null when the referenced vlan does not exist', async () => {
    subnetRepo.save.mockImplementation(async (subnet: Subnet) => ({
      id: 42,
      ...subnet,
    }));
    const result = await service.importNetwork(
      [],
      [{ cidr: '192.168.220.0/24', name: 'bridge220', vlanId: 999 }],
    );
    expect(result.subnetsCreated).toBe(1);
    expect(subnetRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ cidr: '192.168.220.0/24', vlanId: null }),
    );
  });

  it('ignores invalid cidrs and invalid gateways', async () => {
    const result = await service.importNetwork(
      [],
      [
        { cidr: 'not-a-cidr', name: 'bad' },
        { cidr: '192.168.1.0/24', name: 'bad-gw', gateway: 'nope' },
      ],
    );
    expect(result.subnetsCreated).toBe(1);
    expect(result.gatewaysAdded).toBe(0);
  });

  it('links an existing subnet to a vlan when it has none', async () => {
    const existing = { id: 7, cidr: '192.168.220.0/24', vlanId: null } as Subnet;
    subnetRepo.findOne.mockResolvedValue(existing);
    vlanRepo.findOne.mockImplementation(async ({ where }: { where: { vlanId: number } }) =>
      where.vlanId === 220 ? { id: 9, vlanId: 220 } : null,
    );
    const result = await service.importNetwork(
      [],
      [{ cidr: '192.168.220.0/24', name: 'bridge220', vlanId: 220 }],
    );
    expect(result.subnetsLinked).toBe(1);
    expect(existing.vlanId).toBe(9);
    expect(subnetRepo.save).toHaveBeenCalledWith(existing);
  });

  it('does not overwrite an existing vlan link', async () => {
    const existing = { id: 7, cidr: '192.168.220.0/24', vlanId: 5 } as Subnet;
    subnetRepo.findOne.mockResolvedValue(existing);
    const result = await service.importNetwork(
      [],
      [{ cidr: '192.168.220.0/24', name: 'bridge220', vlanId: 220 }],
    );
    expect(result.subnetsLinked).toBe(0);
    expect(existing.vlanId).toBe(5);
  });

  it('adds a missing gateway to an existing subnet', async () => {
    const existing = { id: 7, cidr: '192.168.220.0/24', vlanId: 220 } as Subnet;
    subnetRepo.findOne.mockResolvedValue(existing);
    gatewayRepo.find.mockResolvedValue([]);
    const result = await service.importNetwork(
      [],
      [{ cidr: '192.168.220.0/24', name: 'bridge220', gateway: '192.168.220.1' }],
    );
    expect(result.gatewaysAdded).toBe(1);
    expect(gatewayRepo.create).toHaveBeenCalledWith({ ip: '192.168.220.1', subnetId: 7 });
  });

  it('does not duplicate an existing gateway', async () => {
    const existing = { id: 7, cidr: '192.168.220.0/24', vlanId: 220 } as Subnet;
    subnetRepo.findOne.mockResolvedValue(existing);
    gatewayRepo.find.mockResolvedValue([{ id: 1, ip: '192.168.220.1', subnetId: 7 }]);
    const result = await service.importNetwork(
      [],
      [{ cidr: '192.168.220.0/24', name: 'bridge220', gateway: '192.168.220.1' }],
    );
    expect(result.gatewaysAdded).toBe(0);
    expect(gatewayRepo.create).not.toHaveBeenCalled();
  });

  it('links orphan devices to the subnet containing their ip', async () => {
    const subnet = { id: 7, cidr: '192.168.220.0/24' } as Subnet;
    subnetRepo.find.mockResolvedValue([subnet]);
    const orphan = makeDevice({ id: 55, ip: '192.168.220.50' });
    const outside = makeDevice({ id: 56, ip: '10.9.9.9' });
    deviceRepo.find.mockResolvedValue([orphan, outside]);
    const result = await service.importNetwork([], []);
    expect(result.devicesLinked).toBe(1);
    expect(orphan.subnetId).toBe(7);
    expect(outside.subnetId).toBeNull();
    expect(deviceRepo.save).toHaveBeenCalledWith(orphan);
  });

  it('creates a missing subnet with domain, dns and ntp config', async () => {
    subnetRepo.save.mockImplementation(async (subnet: Subnet) => ({
      id: 42,
      ...subnet,
    }));
    const result = await service.importNetwork(
      [],
      [
        {
          cidr: '192.168.4.0/24',
          name: 'bridge4',
          domainName: 'sec.pillon.org',
          dnsServers: ['1.1.1.1', '8.8.8.8'],
          ntpServers: ['ntp.pillon.org'],
        },
      ],
    );
    expect(result.subnetsCreated).toBe(1);
    expect(result.subnetConfigsAdded).toBe(1);
    expect(subnetRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        cidr: '192.168.4.0/24',
        domainName: 'sec.pillon.org',
        dnsServers: '1.1.1.1, 8.8.8.8',
        ntpServers: 'ntp.pillon.org',
      }),
    );
  });

  it('fills empty config fields on an existing subnet without overwriting set ones', async () => {
    const existing = {
      id: 7,
      cidr: '192.168.4.0/24',
      vlanId: null,
      domainName: '',
      dnsServers: '9.9.9.9',
      ntpServers: '',
    } as Subnet;
    subnetRepo.findOne.mockResolvedValue(existing);
    const result = await service.importNetwork(
      [],
      [
        {
          cidr: '192.168.4.0/24',
          name: 'bridge4',
          domainName: 'sec.pillon.org',
          dnsServers: ['1.1.1.1'],
          ntpServers: ['ntp.pillon.org'],
        },
      ],
    );
    expect(result.subnetConfigsAdded).toBe(1);
    expect(existing.domainName).toBe('sec.pillon.org');
    expect(existing.dnsServers).toBe('9.9.9.9');
    expect(existing.ntpServers).toBe('ntp.pillon.org');
    expect(subnetRepo.save).toHaveBeenCalledWith(existing);
  });

  it('creates an offline device for a reserved ip and links it to its subnet', async () => {
    const subnet = { id: 7, cidr: '192.168.220.0/24' } as Subnet;
    subnetRepo.find.mockResolvedValue([subnet]);
    deviceRepo.findOne.mockResolvedValue(null);
    const result = await service.importNetwork(
      [],
      [],
      [{ ip: '192.168.220.100', mac: 'AA:BB:CC:DD:EE:FF', hostname: 'reserved-host' }],
    );
    expect(result.reservedDevicesAdded).toBe(1);
    expect(deviceRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        ip: '192.168.220.100',
        mac: 'AA:BB:CC:DD:EE:FF',
        hostname: 'reserved-host',
        subnetId: 7,
        status: 'offline',
      }),
    );
  });

  it('emits device.created only for the reserved ips it creates', async () => {
    const subnet = { id: 7, cidr: '192.168.220.0/24' } as Subnet;
    subnetRepo.find.mockResolvedValue([subnet]);
    deviceRepo.findOne.mockImplementation(
      async ({ where }: { where: { ip: string } }) =>
        where.ip === '192.168.220.5'
          ? makeDevice({ id: 55, ip: '192.168.220.5', subnetId: 7 })
          : null,
    );
    deviceRepo.save.mockImplementation(async (device: Device) => ({
      ...device,
      id: device.id ?? 300,
    }));

    await service.importNetwork(
      [],
      [],
      [
        { ip: '192.168.220.5', hostname: 'known' },
        { ip: '192.168.220.100' },
      ],
    );

    expect(events).toEqual([
      {
        type: 'device.created',
        data: { deviceId: 300, ip: '192.168.220.100', subnetId: 7 },
      },
    ]);
  });

  it('fills mac and hostname on an existing device without touching its status', async () => {
    const subnet = { id: 7, cidr: '192.168.220.0/24' } as Subnet;
    subnetRepo.find.mockResolvedValue([subnet]);
    const existing = makeDevice({
      id: 55,
      ip: '192.168.220.100',
      mac: '',
      hostname: '',
      subnetId: 7,
      status: 'online',
    });
    deviceRepo.findOne.mockResolvedValue(existing);
    const result = await service.importNetwork(
      [],
      [],
      [{ ip: '192.168.220.100', mac: 'AA:BB', hostname: 'host' }],
    );
    expect(result.reservedDevicesAdded).toBe(0);
    expect(existing.mac).toBe('AA:BB');
    expect(existing.hostname).toBe('host');
    expect(existing.status).toBe('online');
    expect(deviceRepo.save).toHaveBeenCalledWith(existing);
  });

  it('adds a dhcp pool to the subnet containing the range', async () => {
    const subnet = { id: 7, cidr: '192.168.220.0/24' } as Subnet;
    subnetRepo.find.mockResolvedValue([subnet]);
    poolRepo.find.mockResolvedValue([]);
    const result = await service.importNetwork(
      [],
      [],
      [],
      [{ name: 'dhcp-220', startIp: '192.168.220.100', endIp: '192.168.220.200' }],
    );
    expect(result.poolsAdded).toBe(1);
    expect(poolRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'dhcp-220',
        startIp: '192.168.220.100',
        endIp: '192.168.220.200',
        subnetId: 7,
      }),
    );
  });

  it('updates the range of an existing pool with the same name', async () => {
    const subnet = { id: 7, cidr: '192.168.220.0/24' } as Subnet;
    subnetRepo.find.mockResolvedValue([subnet]);
    const pool = {
      id: 3,
      name: 'dhcp-220',
      startIp: '192.168.220.10',
      endIp: '192.168.220.50',
      subnetId: 7,
    } as DhcpPool;
    poolRepo.find.mockResolvedValue([pool]);
    const result = await service.importNetwork(
      [],
      [],
      [],
      [{ name: 'dhcp-220', startIp: '192.168.220.100', endIp: '192.168.220.200' }],
    );
    expect(result.poolsAdded).toBe(0);
    expect(pool.startIp).toBe('192.168.220.100');
    expect(pool.endIp).toBe('192.168.220.200');
    expect(poolRepo.save).toHaveBeenCalledWith(pool);
  });

  it('skips a dhcp range that fits no subnet', async () => {
    const subnet = { id: 7, cidr: '192.168.220.0/24' } as Subnet;
    subnetRepo.find.mockResolvedValue([subnet]);
    const result = await service.importNetwork(
      [],
      [],
      [],
      [{ name: 'vpn', startIp: '10.9.9.10', endIp: '10.9.9.20' }],
    );
    expect(result.poolsAdded).toBe(0);
    expect(poolRepo.find).not.toHaveBeenCalled();
  });
});
