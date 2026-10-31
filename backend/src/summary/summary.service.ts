import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { totalHosts } from '../lib/cidr';
import { Vlan } from '../entities/vlan.entity';
import { Subnet } from '../entities/subnet.entity';
import { Device } from '../entities/device.entity';

export interface SubnetUtilization {
  id: number;
  name: string;
  cidr: string;
  used: number;
  total: number;
  percent: number;
}

export interface SummaryResponse {
  vlans: number;
  subnets: number;
  devices: number;
  devicesOnline: number;
  devicesOffline: number;
  subnetsUtilization: SubnetUtilization[];
}

@Injectable()
export class SummaryService {
  constructor(
    @InjectRepository(Vlan) private readonly vlanRepo: Repository<Vlan>,
    @InjectRepository(Subnet) private readonly subnetRepo: Repository<Subnet>,
    @InjectRepository(Device) private readonly deviceRepo: Repository<Device>,
  ) {}

  async get(): Promise<SummaryResponse> {
    const [vlans, subnets, devices, devicesOnline, devicesOffline] =
      await Promise.all([
        this.vlanRepo.count(),
        this.subnetRepo.count(),
        this.deviceRepo.count(),
        this.deviceRepo.count({ where: { status: 'online' } }),
        this.deviceRepo.count({ where: { status: 'offline' } }),
      ]);
    const allSubnets = await this.subnetRepo.find();
    const deviceCounts = await this.deviceCounts();
    const subnetsUtilization = allSubnets.map((subnet) => {
      const used = deviceCounts.get(subnet.id) ?? 0;
      const total = totalHosts(subnet.cidr, subnet.includeFirstLast);
      const percent = total === 0 ? 0 : Math.round((used / total) * 1000) / 10;
      return {
        id: subnet.id,
        name: subnet.name,
        cidr: subnet.cidr,
        used,
        total,
        percent,
      };
    });
    return {
      vlans,
      subnets,
      devices,
      devicesOnline,
      devicesOffline,
      subnetsUtilization,
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
