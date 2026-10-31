import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { MoreThanOrEqual, Repository } from 'typeorm';
import { hashApiKey } from '../lib/api-key';
import { isValidCidr, cidrContains, isValidIp } from '../lib/cidr';
import { Device } from '../entities/device.entity';
import { Subnet } from '../entities/subnet.entity';
import { ApiKey } from '../entities/api-key.entity';
import { ScanReport } from '../entities/scan-report.entity';
import { EventsService } from '../events/events.service';
import {
  LiveEventData,
  ScanReportSubnet,
  deviceCreatedEvent,
} from '../events/live-event';
import { ScanDeviceDto, ScanReportDto } from './scan.dto';

export interface ScanResult {
  received: number;
  created: number;
  updated: number;
  reportId: number;
}

export interface SeenDevice {
  id: number;
  ip: string;
  subnetId: number | null;
  created: boolean;
}

export interface UpsertResult {
  created: number;
  updated: number;
  devices: SeenDevice[];
}

export interface ReportFilter {
  subnetId?: number;
  since?: Date;
}

type ScanOrigin = Omit<LiveEventData['scan.report'], 'subnets'>;

@Injectable()
export class ScanService {
  constructor(
    @InjectRepository(Device) private readonly deviceRepo: Repository<Device>,
    @InjectRepository(Subnet) private readonly subnetRepo: Repository<Subnet>,
    @InjectRepository(ApiKey) private readonly apiKeyRepo: Repository<ApiKey>,
    @InjectRepository(ScanReport)
    private readonly reportRepo: Repository<ScanReport>,
    private readonly events: EventsService,
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
    const subnets = groupBySubnet(counts.devices);
    const report = this.reportRepo.create({
      agent,
      platform: platform ?? '',
      deviceCount: devices.length,
      receivedAt: new Date(),
      subnetIds: subnets.flatMap(({ subnetId }) =>
        subnetId === null ? [] : [subnetId],
      ),
    });
    const saved = await this.reportRepo.save(report);
    this.publishScan(
      {
        agent,
        source: 'report',
        receivedAt: saved.receivedAt.toISOString(),
        reportId: saved.id,
      },
      counts.devices,
      subnets,
    );
    return {
      received: devices.length,
      created: counts.created,
      updated: counts.updated,
      reportId: saved.id,
    };
  }

  async receiveConnectorResult(
    agent: string,
    devices: ScanDeviceDto[],
  ): Promise<UpsertResult> {
    const result = await this.upsertDevices(devices);
    this.publishScan(
      { agent, source: 'connector', receivedAt: new Date().toISOString() },
      result.devices,
      groupBySubnet(result.devices),
    );
    return result;
  }

  private async upsertDevices(devices: ScanDeviceDto[]): Promise<UpsertResult> {
    const subnets = await this.subnetRepo.find();
    const now = new Date();
    let created = 0;
    let updated = 0;
    const seen = new Map<number, SeenDevice>();
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
        const saved = await this.deviceRepo.save(existing);
        if (!seen.has(saved.id)) {
          seen.set(saved.id, this.seenDevice(saved, false));
        }
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
        const saved = await this.deviceRepo.save(device);
        seen.set(saved.id, this.seenDevice(saved, true));
        created += 1;
      }
    }
    return { created, updated, devices: [...seen.values()] };
  }

  async listReports(
    limit?: number,
    filter: ReportFilter = {},
  ): Promise<ScanReport[]> {
    const fallback = 50;
    const value =
      limit === undefined || !Number.isFinite(limit)
        ? fallback
        : Math.trunc(limit);
    const clamped = Math.min(200, Math.max(1, value));
    const where = filter.since
      ? { receivedAt: MoreThanOrEqual(filter.since) }
      : {};
    const order = { receivedAt: 'DESC', id: 'DESC' } as const;
    const { subnetId } = filter;
    if (subnetId === undefined) {
      return this.reportRepo.find({ where, order, take: clamped });
    }
    const reports = await this.reportRepo.find({ where, order });
    return reports
      .filter((report) => report.subnetIds.includes(subnetId))
      .slice(0, clamped);
  }

  private seenDevice(device: Device, created: boolean): SeenDevice {
    return { id: device.id, ip: device.ip, subnetId: device.subnetId, created };
  }

  private publishScan(
    origin: ScanOrigin,
    devices: SeenDevice[],
    subnets: ScanReportSubnet[],
  ): void {
    for (const device of devices) {
      if (device.created) this.events.publish(deviceCreatedEvent(device));
    }
    this.events.publish({
      type: 'scan.report',
      data: { ...origin, subnets },
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

function groupBySubnet(devices: SeenDevice[]): ScanReportSubnet[] {
  const groups = new Map<number | null, number[]>();
  for (const device of devices) {
    const ids = groups.get(device.subnetId) ?? [];
    ids.push(device.id);
    groups.set(device.subnetId, ids);
  }
  return [...groups].map(([subnetId, deviceIds]) => ({ subnetId, deviceIds }));
}
