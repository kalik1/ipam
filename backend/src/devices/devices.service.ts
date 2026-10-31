import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { cidrContains, isValidCidr, isValidIp } from '../lib/cidr';
import { Device, DeviceStatus } from '../entities/device.entity';
import { Subnet } from '../entities/subnet.entity';
import { CreateDeviceDto, UpdateDeviceDto } from './devices.dto';

@Injectable()
export class DevicesService {
  constructor(
    @InjectRepository(Device) private readonly deviceRepo: Repository<Device>,
    @InjectRepository(Subnet) private readonly subnetRepo: Repository<Subnet>,
  ) {}

  async findAll(
    subnetId?: number,
    status?: DeviceStatus,
    search?: string,
  ): Promise<Device[]> {
    const qb = this.deviceRepo
      .createQueryBuilder('d')
      .leftJoinAndSelect('d.subnet', 'subnet');
    if (subnetId !== undefined) {
      qb.andWhere('d.subnetId = :subnetId', { subnetId });
    }
    if (status !== undefined) {
      qb.andWhere('d.status = :status', { status });
    }
    if (search) {
      const term = `%${search.toLowerCase()}%`;
      qb.andWhere(
        '(LOWER(d.ip) LIKE :term OR LOWER(d.hostname) LIKE :term OR LOWER(d.mac) LIKE :term)',
        { term },
      );
    }
    return qb.orderBy('d.ip', 'ASC').getMany();
  }

  async create(dto: CreateDeviceDto): Promise<Device> {
    if (!isValidIp(dto.ip)) {
      throw new BadRequestException('Invalid IP address');
    }
    if (await this.ipExists(dto.ip)) {
      throw new ConflictException('IP already exists');
    }
    const subnetId =
      dto.subnetId !== undefined
        ? await this.resolveSubnetId(dto.subnetId)
        : await this.autoAssignSubnetId(dto.ip);
    const device = this.deviceRepo.create({
      ip: dto.ip,
      mac: dto.mac ?? '',
      hostname: dto.hostname ?? '',
      vendor: dto.vendor ?? '',
      subnetId,
      status: 'online',
      lastSeen: new Date(),
      notes: dto.notes ?? '',
    });
    const saved = await this.deviceRepo.save(device);
    return this.findById(saved.id);
  }

  async update(id: number, dto: UpdateDeviceDto): Promise<Device> {
    const device = await this.findById(id);
    if (dto.ip !== undefined) {
      if (!isValidIp(dto.ip)) {
        throw new BadRequestException('Invalid IP address');
      }
      const existing = await this.deviceRepo.findOne({ where: { ip: dto.ip } });
      if (existing && existing.id !== id) {
        throw new ConflictException('IP already exists');
      }
      device.ip = dto.ip;
    }
    if (dto.mac !== undefined) device.mac = dto.mac;
    if (dto.hostname !== undefined) device.hostname = dto.hostname;
    if (dto.vendor !== undefined) device.vendor = dto.vendor;
    if (dto.notes !== undefined) device.notes = dto.notes;
    if (dto.subnetId !== undefined) {
      device.subnet =
        dto.subnetId === null ? null : await this.findSubnet(dto.subnetId);
      device.subnetId = device.subnet?.id ?? null;
    }
    const saved = await this.deviceRepo.save(device);
    return this.findById(saved.id);
  }

  async remove(id: number): Promise<void> {
    const device = await this.deviceRepo.findOne({ where: { id } });
    if (!device) throw new NotFoundException('Device not found');
    await this.deviceRepo.remove(device);
  }

  private async ipExists(ip: string): Promise<boolean> {
    return (await this.deviceRepo.findOne({ where: { ip } })) !== null;
  }

  private async findById(id: number): Promise<Device> {
    const device = await this.deviceRepo.findOne({
      where: { id },
      relations: { subnet: true },
    });
    if (!device) throw new NotFoundException('Device not found');
    return device;
  }

  private async resolveSubnetId(subnetId: number): Promise<number> {
    return (await this.findSubnet(subnetId)).id;
  }

  private async findSubnet(id: number): Promise<Subnet> {
    const subnet = await this.subnetRepo.findOne({ where: { id } });
    if (!subnet) throw new BadRequestException('Subnet not found');
    return subnet;
  }

  private async autoAssignSubnetId(ip: string): Promise<number | null> {
    const subnets = await this.subnetRepo.find();
    for (const subnet of subnets) {
      if (isValidCidr(subnet.cidr) && cidrContains(subnet.cidr, ip)) {
        return subnet.id;
      }
    }
    return null;
  }
}
