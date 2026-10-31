import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, Repository } from 'typeorm';
import { Device } from '../entities/device.entity';

const OFFLINE_THRESHOLD_MS = 5 * 60 * 1000;

@Injectable()
export class DeviceStatusScheduler {
  constructor(
    @InjectRepository(Device) private readonly deviceRepo: Repository<Device>,
  ) {}

  @Cron('*/1 * * * * *')
  async markStaleDevicesOffline(): Promise<void> {
    const cutoff = new Date(Date.now() - OFFLINE_THRESHOLD_MS);
    const stale = await this.deviceRepo.find({
      where: { lastSeen: LessThan(cutoff) },
    });
    for (const device of stale) {
      if (device.status !== 'offline') {
        device.status = 'offline';
        await this.deviceRepo.save(device);
      }
    }
  }
}
