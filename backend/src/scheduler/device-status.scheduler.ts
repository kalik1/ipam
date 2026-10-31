import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, Repository } from 'typeorm';
import { Device } from '../entities/device.entity';
import { EventsService } from '../events/events.service';

const OFFLINE_THRESHOLD_MS = 5 * 60 * 1000;

@Injectable()
export class DeviceStatusScheduler {
  constructor(
    @InjectRepository(Device) private readonly deviceRepo: Repository<Device>,
    private readonly events: EventsService,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async markStaleDevicesOffline(): Promise<void> {
    const cutoff = new Date(Date.now() - OFFLINE_THRESHOLD_MS);
    const stale = await this.deviceRepo.find({
      where: { lastSeen: LessThan(cutoff), status: 'online' },
    });
    const deviceIds: number[] = [];
    for (const device of stale) {
      if (device.status === 'offline') continue;
      device.status = 'offline';
      await this.deviceRepo.save(device);
      deviceIds.push(device.id);
    }
    if (deviceIds.length > 0) {
      this.events.publish({ type: 'device.offline', data: { deviceIds } });
    }
  }
}
