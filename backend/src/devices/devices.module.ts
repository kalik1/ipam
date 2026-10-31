import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Device } from '../entities/device.entity';
import { Subnet } from '../entities/subnet.entity';
import { DevicesController } from './devices.controller';
import { DevicesService } from './devices.service';

@Module({
  imports: [TypeOrmModule.forFeature([Device, Subnet])],
  controllers: [DevicesController],
  providers: [DevicesService],
})
export class DevicesModule {}
