import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Device } from '../entities/device.entity';
import { DeviceStatusScheduler } from './device-status.scheduler';

@Module({
  imports: [TypeOrmModule.forFeature([Device])],
  providers: [DeviceStatusScheduler],
})
export class SchedulerModule {}
