import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcryptjs';
import { Repository } from 'typeorm';
import { generateApiKey, hashApiKey } from '../lib/api-key';
import { ApiKey } from '../entities/api-key.entity';
import { Connector } from '../entities/connector.entity';
import { Device, DeviceStatus } from '../entities/device.entity';
import { Subnet } from '../entities/subnet.entity';
import { User } from '../entities/user.entity';
import { Vlan } from '../entities/vlan.entity';
import { Gateway } from '../entities/gateway.entity';
import { DhcpPool } from '../entities/dhcp-pool.entity';

interface SeedDevice {
  ip: string;
  mac: string;
  hostname: string;
  vendor: string;
  subnetIndex: number;
  lastSeenMinutesAgo: number;
  status: DeviceStatus;
}

const SEED_DEVICES: SeedDevice[] = [
  { ip: '10.0.0.10', mac: 'AA:BB:CC:01:00:0A', hostname: 'core-switch', vendor: 'Cisco', subnetIndex: 0, lastSeenMinutesAgo: 0, status: 'online' },
  { ip: '10.0.0.20', mac: 'AA:BB:CC:01:00:14', hostname: 'firewall', vendor: 'Palo Alto', subnetIndex: 0, lastSeenMinutesAgo: 0, status: 'online' },
  { ip: '10.0.1.2', mac: 'AA:BB:CC:02:00:02', hostname: 'peer-a', vendor: 'Juniper', subnetIndex: 1, lastSeenMinutesAgo: 0, status: 'online' },
  { ip: '10.0.1.3', mac: 'AA:BB:CC:02:00:03', hostname: 'peer-b', vendor: 'Juniper', subnetIndex: 1, lastSeenMinutesAgo: 0, status: 'online' },
  { ip: '192.168.1.10', mac: 'AA:BB:CC:10:00:0A', hostname: 'workstation-01', vendor: 'HP', subnetIndex: 2, lastSeenMinutesAgo: 0, status: 'online' },
  { ip: '192.168.1.20', mac: 'AA:BB:CC:10:00:14', hostname: 'workstation-02', vendor: 'Dell', subnetIndex: 2, lastSeenMinutesAgo: 0, status: 'online' },
  { ip: '192.168.1.30', mac: 'AA:BB:CC:10:00:1E', hostname: 'printer-01', vendor: 'HP', subnetIndex: 2, lastSeenMinutesAgo: 120, status: 'offline' },
  { ip: '192.168.2.10', mac: 'AA:BB:CC:11:00:0A', hostname: 'nas-01', vendor: 'Synology', subnetIndex: 3, lastSeenMinutesAgo: 0, status: 'online' },
  { ip: '192.168.2.50', mac: 'AA:BB:CC:11:00:32', hostname: 'camera-01', vendor: 'Hikvision', subnetIndex: 3, lastSeenMinutesAgo: 180, status: 'offline' },
  { ip: '172.16.0.10', mac: 'AA:BB:CC:20:00:0A', hostname: 'web-server-01', vendor: 'Supermicro', subnetIndex: 4, lastSeenMinutesAgo: 0, status: 'online' },
  { ip: '172.16.0.20', mac: 'AA:BB:CC:20:00:14', hostname: 'db-server-01', vendor: 'Dell', subnetIndex: 4, lastSeenMinutesAgo: 0, status: 'online' },
  { ip: '172.16.0.30', mac: 'AA:BB:CC:20:00:1E', hostname: 'app-server-01', vendor: 'HPE', subnetIndex: 4, lastSeenMinutesAgo: 30, status: 'offline' },
  { ip: '172.16.0.40', mac: 'AA:BB:CC:20:00:28', hostname: 'backup-server', vendor: 'Lenovo', subnetIndex: 4, lastSeenMinutesAgo: 1440, status: 'offline' },
];

interface SeedPool {
  name: string;
  startIp: string;
  endIp: string;
}

interface SeedSubnet {
  cidr: string;
  name: string;
  gateways: string[];
  includeFirstLast: boolean;
  pools: SeedPool[];
  vlanIndex: number;
  description: string;
}

const SEED_SUBNETS: SeedSubnet[] = [
  {
    cidr: '10.0.0.0/24',
    name: 'Management LAN',
    gateways: ['10.0.0.1', '10.0.0.2'],
    includeFirstLast: false,
    pools: [{ name: 'default', startIp: '10.0.0.100', endIp: '10.0.0.199' }],
    vlanIndex: 0,
    description: '',
  },
  {
    cidr: '10.0.1.0/30',
    name: 'Management P2P',
    gateways: ['10.0.1.1'],
    includeFirstLast: true,
    pools: [],
    vlanIndex: 0,
    description: 'Point-to-point link',
  },
  {
    cidr: '192.168.1.0/24',
    name: 'Users LAN',
    gateways: ['192.168.1.1', '192.168.1.2'],
    includeFirstLast: false,
    pools: [
      { name: 'users', startIp: '192.168.1.100', endIp: '192.168.1.200' },
      { name: 'servers', startIp: '192.168.1.10', endIp: '192.168.1.20' },
    ],
    vlanIndex: 1,
    description: '',
  },
  {
    cidr: '192.168.2.0/24',
    name: 'Users LAN 2',
    gateways: ['192.168.2.1'],
    includeFirstLast: false,
    pools: [],
    vlanIndex: 1,
    description: '',
  },
  {
    cidr: '172.16.0.0/16',
    name: 'Servers LAN',
    gateways: ['172.16.0.1', '172.16.0.2'],
    includeFirstLast: false,
    pools: [],
    vlanIndex: 2,
    description: '',
  },
];

@Injectable()
export class SeedService implements OnApplicationBootstrap {
  constructor(
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    @InjectRepository(Vlan) private readonly vlanRepo: Repository<Vlan>,
    @InjectRepository(Subnet) private readonly subnetRepo: Repository<Subnet>,
    @InjectRepository(Device) private readonly deviceRepo: Repository<Device>,
    @InjectRepository(Gateway) private readonly gatewayRepo: Repository<Gateway>,
    @InjectRepository(DhcpPool) private readonly poolRepo: Repository<DhcpPool>,
    @InjectRepository(ApiKey) private readonly apiKeyRepo: Repository<ApiKey>,
    @InjectRepository(Connector) private readonly connectorRepo: Repository<Connector>,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    const userCount = await this.userRepo.count();
    if (userCount === 0) {
      await this.seedBaseData();
    }
    const connectorCount = await this.connectorRepo.count();
    if (connectorCount === 0) {
      await this.connectorRepo.save(
        this.connectorRepo.create({
          name: 'mikrotik',
          label: 'MikroTik (example)',
          config: {
            host: '192.168.1.1',
            port: 8728,
            username: 'admin',
            password: 'password',
          },
        }),
      );
    }
  }

  private async seedBaseData(): Promise<void> {
    await this.userRepo.save(
      this.userRepo.create({
        username: 'admin',
        passwordHash: bcrypt.hashSync('admin', 10),
      }),
    );

    const [management, users, servers] = await Promise.all([
      this.vlanRepo.save(
        this.vlanRepo.create({
          vlanId: 10,
          name: 'Management',
          description: 'Management network',
        }),
      ),
      this.vlanRepo.save(
        this.vlanRepo.create({
          vlanId: 20,
          name: 'Users',
          description: 'User workstations',
        }),
      ),
      this.vlanRepo.save(
        this.vlanRepo.create({
          vlanId: 30,
          name: 'Servers',
          description: 'Server farm',
        }),
      ),
    ]);
    const vlans = [management, users, servers];

    const subnets: Subnet[] = [];
    for (const seed of SEED_SUBNETS) {
      const subnet = await this.subnetRepo.save(
        this.subnetRepo.create({
          cidr: seed.cidr,
          name: seed.name,
          includeFirstLast: seed.includeFirstLast,
          vlanId: vlans[seed.vlanIndex].id,
          description: seed.description,
        }),
      );
      for (const ip of seed.gateways) {
        await this.gatewayRepo.save(
          this.gatewayRepo.create({ ip, subnetId: subnet.id }),
        );
      }
      for (const pool of seed.pools) {
        await this.poolRepo.save(
          this.poolRepo.create({
            name: pool.name,
            startIp: pool.startIp,
            endIp: pool.endIp,
            subnetId: subnet.id,
          }),
        );
      }
      subnets.push(subnet);
    }

    const now = Date.now();
    for (const seed of SEED_DEVICES) {
      await this.deviceRepo.save(
        this.deviceRepo.create({
          ip: seed.ip,
          mac: seed.mac,
          hostname: seed.hostname,
          vendor: seed.vendor,
          subnetId: subnets[seed.subnetIndex].id,
          status: seed.status,
          lastSeen: new Date(now - seed.lastSeenMinutesAgo * 60 * 1000),
          notes: '',
        }),
      );
    }

    const key = generateApiKey();
    await this.apiKeyRepo.save(
      this.apiKeyRepo.create({
        name: 'seed',
        keyHash: hashApiKey(key),
        keyPrefix: key.slice(0, 8),
      }),
    );
    console.log(`Seed API key (shown once): ${key}`);
  }
}
