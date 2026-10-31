import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { hashApiKey } from '../lib/api-key';
import { isValidCidr, cidrContains, isValidIp } from '../lib/cidr';
import { Device } from '../entities/device.entity';
import { Subnet } from '../entities/subnet.entity';
import { ApiKey } from '../entities/api-key.entity';
import { ScanReport } from '../entities/scan-report.entity';
import { ScanDeviceDto, ScanReportDto } from './scan.dto';

export interface ScanResult {
  received: number;
  created: number;
  updated: number;
  reportId: number;
}

@Injectable()
export class ScanService {
  constructor(
    @InjectRepository(Device) private readonly deviceRepo: Repository<Device>,
    @InjectRepository(Subnet) private readonly subnetRepo: Repository<Subnet>,
    @InjectRepository(ApiKey) private readonly apiKeyRepo: Repository<ApiKey>,
    @InjectRepository(ScanReport)
    private readonly reportRepo: Repository<ScanReport>,
  ) {}

  async receive(
    apiKey: string | undefined,
    dto: ScanReportDto,
  ): Promise<ScanResult> {
    if (!apiKey) throw new UnauthorizedException('Missing API key');
    const keyRecord = await this.apiKeyRepo.findOne({
      where: { keyHash: hashApiKey(apiKey) },
    });
    if (!keyRecord) throw new UnauthorizedException('Invalid API key');
    return this.receiveForKey(
      keyRecord,
      dto.agent,
      dto.platform,
      dto.devices,
    );
  }

  async receiveForKey(
    keyRecord: ApiKey,
    agent: string,
    platform: string | undefined,
    devices: ScanDeviceDto[],
  ): Promise<ScanResult> {
    keyRecord.lastUsedAt = new Date();
    await this.apiKeyRepo.save(keyRecord);

    const counts = await this.upsertDevices(devices);
    const report = this.reportRepo.create({
      agent,
      platform: platform ?? '',
      deviceCount: devices.length,
      receivedAt: new Date(),
    });
    const saved = await this.reportRepo.save(report);
    return {
      received: devices.length,
      created: counts.created,
      updated: counts.updated,
      reportId: saved.id,
    };
  }

  async upsertDevices(
    devices: ScanDeviceDto[],
  ): Promise<{ created: number; updated: number }> {
    const subnets = await this.subnetRepo.find();
    const now = new Date();
    let created = 0;
    let updated = 0;
    for (const entry of devices) {
      if (!isValidIp(entry.ip)) {
        throw new BadRequestException(`Invalid IP address: ${entry.ip}`);
      }
      const existing = await this.deviceRepo.findOne({ where: { ip: entry.ip } });
      if (existing) {
        if (entry.mac !== undefined) existing.mac = entry.mac;
        if (entry.hostname !== undefined) existing.hostname = entry.hostname;
        if (entry.vendor !== undefined) existing.vendor = entry.vendor;
        existing.status = 'online';
        existing.lastSeen = now;
        await this.deviceRepo.save(existing);
        updated += 1;
      } else {
        const device = this.deviceRepo.create({
          ip: entry.ip,
          mac: entry.mac ?? '',
          hostname: entry.hostname ?? '',
          vendor: entry.vendor ?? '',
          subnetId: this.findSubnetId(subnets, entry.ip),
          status: 'online',
          lastSeen: now,
          notes: '',
        });
        await this.deviceRepo.save(device);
        created += 1;
      }
    }
    return { created, updated };
  }

  async listReports(limit?: number): Promise<ScanReport[]> {
    const fallback = 50;
    const value =
      limit === undefined || !Number.isFinite(limit)
        ? fallback
        : Math.trunc(limit);
    const clamped = Math.min(200, Math.max(1, value));
    return this.reportRepo.find({
      order: { receivedAt: 'DESC', id: 'DESC' },
      take: clamped,
    });
  }

  private findSubnetId(subnets: Subnet[], ip: string): number | null {
    for (const subnet of subnets) {
      if (isValidCidr(subnet.cidr) && cidrContains(subnet.cidr, ip)) {
        return subnet.id;
      }
    }
    return null;
  }
}
