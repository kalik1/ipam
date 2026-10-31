import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { toSubnetResponse, SubnetResponse } from '../lib/subnet-response';
import { Device } from '../entities/device.entity';
import { Subnet } from '../entities/subnet.entity';
import { Vlan } from '../entities/vlan.entity';
import { CreateVlanDto, UpdateVlanDto } from './vlans.dto';

export interface VlanDetail extends Omit<Vlan, 'subnets'> {
  subnets: SubnetResponse[];
  deviceCount: number;
}

@Injectable()
export class VlansService {
  constructor(
    @InjectRepository(Vlan) private readonly vlanRepo: Repository<Vlan>,
    @InjectRepository(Subnet) private readonly subnetRepo: Repository<Subnet>,
    @InjectRepository(Device) private readonly deviceRepo: Repository<Device>,
  ) {}

  async findAll(search?: string): Promise<Vlan[]> {
    const qb = this.vlanRepo.createQueryBuilder('v');
    if (search) {
      const term = `%${search.toLowerCase()}%`;
      qb.where('LOWER(v.name) LIKE :term', { term }).orWhere(
        'LOWER(v.description) LIKE :term',
        { term },
      );
    }
    return qb.orderBy('v.vlanId', 'ASC').getMany();
  }

  async create(dto: CreateVlanDto): Promise<Vlan> {
    const existing = await this.vlanRepo.findOne({ where: { vlanId: dto.vlanId } });
    if (existing) throw new ConflictException('VLAN ID already exists');
    const vlan = this.vlanRepo.create({
      vlanId: dto.vlanId,
      name: dto.name,
      description: dto.description ?? '',
    });
    return this.vlanRepo.save(vlan);
  }

  async update(vlanId: number, dto: UpdateVlanDto): Promise<Vlan> {
    const vlan = await this.vlanRepo.findOne({ where: { vlanId } });
    if (!vlan) throw new NotFoundException('VLAN not found');
    if (dto.name !== undefined) vlan.name = dto.name;
    if (dto.description !== undefined) vlan.description = dto.description;
    return this.vlanRepo.save(vlan);
  }

  async remove(vlanId: number): Promise<void> {
    const vlan = await this.vlanRepo.findOne({ where: { vlanId } });
    if (!vlan) throw new NotFoundException('VLAN not found');
    const subnetCount = await this.subnetRepo.count({
      where: { vlanId: vlan.id },
    });
    if (subnetCount > 0) {
      throw new ConflictException('Cannot delete VLAN: subnets reference it');
    }
    await this.vlanRepo.remove(vlan);
  }

  async findByIds(ids: number[]): Promise<Map<number, Vlan>> {
    if (ids.length === 0) return new Map();
    const vlans = await this.vlanRepo.find({ where: { id: In(ids) } });
    return new Map(vlans.map((v) => [v.id, v]));
  }

  async findById(id: number): Promise<VlanDetail> {
    const vlan = await this.vlanRepo.findOne({ where: { id } });
    if (!vlan) throw new NotFoundException('VLAN not found');
    const subnets = await this.subnetRepo
      .createQueryBuilder('s')
      .leftJoinAndSelect('s.vlan', 'vlan')
      .leftJoinAndSelect('s.gateways', 'gateways')
      .leftJoinAndSelect('s.dhcpPools', 'pools')
      .where('s.vlanId = :vlanId', { vlanId: id })
      .orderBy('s.id', 'ASC')
      .getMany();
    const counts = await this.deviceCounts();
    const subnetResponses = subnets.map((s) =>
      toSubnetResponse(s, counts.get(s.id) ?? 0),
    );
    const deviceCount = subnetResponses.reduce(
      (sum, s) => sum + s.deviceCount,
      0,
    );
    return {
      id: vlan.id,
      vlanId: vlan.vlanId,
      name: vlan.name,
      description: vlan.description,
      createdAt: vlan.createdAt,
      updatedAt: vlan.updatedAt,
      subnets: subnetResponses,
      deviceCount,
    };
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
