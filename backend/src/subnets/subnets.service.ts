import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  cidrContains,
  ipToNumber,
  isNetworkOrBroadcast,
  isValidCidr,
  isValidIp,
} from '../lib/cidr';
import {
  DhcpPoolResponse,
  SubnetResponse,
  toPoolResponse,
  toSubnetResponse,
} from '../lib/subnet-response';
import { Device } from '../entities/device.entity';
import { Subnet } from '../entities/subnet.entity';
import { Vlan } from '../entities/vlan.entity';
import { Gateway } from '../entities/gateway.entity';
import { DhcpPool } from '../entities/dhcp-pool.entity';
import {
  CreateDhcpPoolDto,
  CreateSubnetDto,
  DhcpPoolDto,
  UpdateDhcpPoolDto,
  UpdateSubnetDto,
} from './subnets.dto';

export interface SubnetDetail extends SubnetResponse {
  devices: Device[];
}

@Injectable()
export class SubnetsService {
  constructor(
    @InjectRepository(Subnet) private readonly subnetRepo: Repository<Subnet>,
    @InjectRepository(Vlan) private readonly vlanRepo: Repository<Vlan>,
    @InjectRepository(Device) private readonly deviceRepo: Repository<Device>,
    @InjectRepository(Gateway) private readonly gatewayRepo: Repository<Gateway>,
    @InjectRepository(DhcpPool) private readonly poolRepo: Repository<DhcpPool>,
  ) {}

  async findAll(vlanId?: number, search?: string): Promise<SubnetResponse[]> {
    const qb = this.subnetRepo
      .createQueryBuilder('s')
      .leftJoinAndSelect('s.vlan', 'vlan')
      .leftJoinAndSelect('s.gateways', 'gateways')
      .leftJoinAndSelect('s.dhcpPools', 'pools');
    if (vlanId !== undefined) {
      qb.where('s.vlanId = :vlanId', { vlanId });
    }
    if (search) {
      const term = `%${search.toLowerCase()}%`;
      qb.andWhere('(LOWER(s.name) LIKE :term OR LOWER(s.cidr) LIKE :term)', {
        term,
      });
    }
    const subnets = await qb.orderBy('s.id', 'ASC').getMany();
    const counts = await this.deviceCounts();
    return subnets.map((s) => toSubnetResponse(s, counts.get(s.id) ?? 0));
  }

  async findById(id: number): Promise<SubnetDetail> {
    const subnet = await this.subnetRepo
      .createQueryBuilder('s')
      .leftJoinAndSelect('s.vlan', 'vlan')
      .leftJoinAndSelect('s.gateways', 'gateways')
      .leftJoinAndSelect('s.dhcpPools', 'pools')
      .where('s.id = :id', { id })
      .getOne();
    if (!subnet) throw new NotFoundException('Subnet not found');
    const devices = await this.deviceRepo.find({
      where: { subnetId: id },
      order: { id: 'ASC' },
    });
    return {
      ...toSubnetResponse(subnet, devices.length),
      devices,
    };
  }

  async create(dto: CreateSubnetDto): Promise<SubnetResponse> {
    if (!isValidCidr(dto.cidr)) {
      throw new BadRequestException('Invalid CIDR');
    }
    const gateways = dto.gateways ?? [];
    const includeFirstLast = dto.includeFirstLast ?? false;
    this.validateGateways(dto.cidr, includeFirstLast, gateways);
    const pools = dto.dhcpPools ?? [];
    for (const pool of pools) {
      this.validatePool(dto.cidr, includeFirstLast, pool);
    }
    const existing = await this.subnetRepo.findOne({ where: { cidr: dto.cidr } });
    if (existing) throw new ConflictException('CIDR already exists');
    const vlanId = await this.resolveVlanId(dto.vlanId);
    const subnet = this.subnetRepo.create({
      cidr: dto.cidr,
      name: dto.name,
      includeFirstLast,
      vlanId,
      description: dto.description ?? '',
      domainName: dto.domainName ?? '',
      dnsServers: dto.dnsServers ?? '',
      ntpServers: dto.ntpServers ?? '',
    });
    const saved = await this.subnetRepo.save(subnet);
    await this.saveGateways(saved.id, gateways);
    await this.savePools(saved.id, pools);
    const loaded = await this.loadSubnet(saved.id);
    return toSubnetResponse(loaded ?? saved, 0);
  }

  async update(id: number, dto: UpdateSubnetDto): Promise<SubnetResponse> {
    const subnet = await this.loadSubnet(id);
    if (!subnet) throw new NotFoundException('Subnet not found');
    if (dto.cidr !== undefined) {
      if (!isValidCidr(dto.cidr)) {
        throw new BadRequestException('Invalid CIDR');
      }
      const existing = await this.subnetRepo.findOne({
        where: { cidr: dto.cidr },
      });
      if (existing && existing.id !== id) {
        throw new ConflictException('CIDR already exists');
      }
      subnet.cidr = dto.cidr;
    }
    const includeFirstLast =
      dto.includeFirstLast ?? subnet.includeFirstLast;
    if (dto.gateways !== undefined) {
      this.validateGateways(subnet.cidr, includeFirstLast, dto.gateways);
    }
    if (dto.dhcpPools !== undefined) {
      for (const pool of dto.dhcpPools) {
        this.validatePool(subnet.cidr, includeFirstLast, pool);
      }
    }
    if (dto.name !== undefined) subnet.name = dto.name;
    if (dto.description !== undefined) subnet.description = dto.description;
    if (dto.includeFirstLast !== undefined) {
      subnet.includeFirstLast = dto.includeFirstLast;
    }
    if (dto.vlanId !== undefined) {
      subnet.vlanId =
        dto.vlanId === null
          ? null
          : await this.resolveVlanId(dto.vlanId);
    }
    if (dto.domainName !== undefined) subnet.domainName = dto.domainName;
    if (dto.dnsServers !== undefined) subnet.dnsServers = dto.dnsServers;
    if (dto.ntpServers !== undefined) subnet.ntpServers = dto.ntpServers;
    await this.subnetRepo.save(subnet);
    if (dto.gateways !== undefined) {
      await this.replaceGateways(id, dto.gateways);
    }
    if (dto.dhcpPools !== undefined) {
      await this.replacePools(id, dto.dhcpPools);
    }
    const loaded = await this.loadSubnet(id);
    const counts = await this.deviceCounts();
    return toSubnetResponse(loaded ?? subnet, counts.get(id) ?? 0);
  }

  async remove(id: number): Promise<void> {
    const subnet = await this.subnetRepo.findOne({ where: { id } });
    if (!subnet) throw new NotFoundException('Subnet not found');
    const deviceCount = await this.deviceRepo.count({ where: { subnetId: id } });
    if (deviceCount > 0) {
      throw new ConflictException('Cannot delete subnet: devices reference it');
    }
    await this.subnetRepo.remove(subnet);
  }

  async findPools(subnetId: number): Promise<DhcpPoolResponse[]> {
    const subnet = await this.subnetRepo.findOne({ where: { id: subnetId } });
    if (!subnet) throw new NotFoundException('Subnet not found');
    const pools = await this.poolRepo.find({
      where: { subnetId },
      order: { id: 'ASC' },
    });
    return pools.map(toPoolResponse);
  }

  async createPool(
    subnetId: number,
    dto: CreateDhcpPoolDto,
  ): Promise<DhcpPoolResponse> {
    const subnet = await this.subnetRepo.findOne({ where: { id: subnetId } });
    if (!subnet) throw new NotFoundException('Subnet not found');
    this.validatePool(subnet.cidr, subnet.includeFirstLast, dto);
    const pool = this.poolRepo.create({
      name: dto.name ?? '',
      startIp: dto.startIp,
      endIp: dto.endIp,
      subnetId,
    });
    const saved = await this.poolRepo.save(pool);
    return toPoolResponse(saved);
  }

  async updatePool(
    poolId: number,
    dto: UpdateDhcpPoolDto,
  ): Promise<DhcpPoolResponse> {
    const pool = await this.poolRepo.findOne({ where: { id: poolId } });
    if (!pool) throw new NotFoundException('DHCP pool not found');
    const subnet = await this.subnetRepo.findOne({
      where: { id: pool.subnetId },
    });
    if (!subnet) throw new NotFoundException('Subnet not found');
    const merged = {
      name: dto.name ?? pool.name,
      startIp: dto.startIp ?? pool.startIp,
      endIp: dto.endIp ?? pool.endIp,
    };
    this.validatePool(subnet.cidr, subnet.includeFirstLast, merged);
    pool.name = merged.name;
    pool.startIp = merged.startIp;
    pool.endIp = merged.endIp;
    const saved = await this.poolRepo.save(pool);
    return toPoolResponse(saved);
  }

  async deletePool(poolId: number): Promise<void> {
    const pool = await this.poolRepo.findOne({ where: { id: poolId } });
    if (!pool) throw new NotFoundException('DHCP pool not found');
    await this.poolRepo.remove(pool);
  }

  private validateGateways(
    cidr: string,
    includeFirstLast: boolean,
    gateways: string[],
  ): void {
    const seen = new Set<number>();
    for (const ip of gateways) {
      if (!isValidIp(ip) || !cidrContains(cidr, ip)) {
        throw new BadRequestException('Gateway must be an IP inside the subnet');
      }
      if (!includeFirstLast && isNetworkOrBroadcast(cidr, ip)) {
        throw new BadRequestException(
          'Gateway must be a usable host IP in the subnet',
        );
      }
      const n = ipToNumber(ip);
      if (seen.has(n)) {
        throw new BadRequestException('Duplicate gateway');
      }
      seen.add(n);
    }
  }

  private validatePool(
    cidr: string,
    includeFirstLast: boolean,
    pool: DhcpPoolDto,
  ): void {
    if (!isValidIp(pool.startIp) || !isValidIp(pool.endIp)) {
      throw new BadRequestException('DHCP pool must use valid IPs');
    }
    if (!cidrContains(cidr, pool.startIp) || !cidrContains(cidr, pool.endIp)) {
      throw new BadRequestException('DHCP pool must be inside the subnet');
    }
    if (ipToNumber(pool.startIp) > ipToNumber(pool.endIp)) {
      throw new BadRequestException('DHCP pool startIp must be <= endIp');
    }
    if (
      !includeFirstLast &&
      (isNetworkOrBroadcast(cidr, pool.startIp) ||
        isNetworkOrBroadcast(cidr, pool.endIp))
    ) {
      throw new BadRequestException('DHCP pool must be within the usable range');
    }
  }

  private async saveGateways(subnetId: number, ips: string[]): Promise<void> {
    for (const ip of ips) {
      await this.gatewayRepo.save(
        this.gatewayRepo.create({ ip, subnetId }),
      );
    }
  }

  private async savePools(
    subnetId: number,
    pools: DhcpPoolDto[],
  ): Promise<void> {
    for (const pool of pools) {
      await this.poolRepo.save(
        this.poolRepo.create({
          name: pool.name ?? '',
          startIp: pool.startIp,
          endIp: pool.endIp,
          subnetId,
        }),
      );
    }
  }

  private async replaceGateways(subnetId: number, ips: string[]): Promise<void> {
    await this.gatewayRepo.delete({ subnetId });
    await this.saveGateways(subnetId, ips);
  }

  private async replacePools(
    subnetId: number,
    pools: DhcpPoolDto[],
  ): Promise<void> {
    await this.poolRepo.delete({ subnetId });
    await this.savePools(subnetId, pools);
  }

  private async loadSubnet(id: number): Promise<Subnet | null> {
    return this.subnetRepo.findOne({
      where: { id },
      relations: { gateways: true, dhcpPools: true, vlan: true },
    });
  }

  private async resolveVlanId(vlanId?: number): Promise<number | null> {
    if (vlanId === undefined) return null;
    const vlan = await this.vlanRepo.findOne({ where: { id: vlanId } });
    if (!vlan) throw new BadRequestException('VLAN not found');
    return vlan.id;
  }

  private async deviceCounts(): Promise<Map<number, number>> {
    const devices = await this.deviceRepo.find({ select: ['subnetId'] });
    const counts = new Map<number, number>();
    for (const device of devices) {
      if (device.subnetId !== null) {
        counts.set(device.subnetId, (counts.get(device.subnetId) ?? 0) + 1);
      }
    }
    return counts;
  }
}
