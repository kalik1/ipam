import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Device } from '../entities/device.entity';
import { Subnet } from '../entities/subnet.entity';
import { ApiKey } from '../entities/api-key.entity';
import { ScanReport } from '../entities/scan-report.entity';
import { ScanController } from './scan.controller';
import { ScanService } from './scan.service';

@Module({
  imports: [TypeOrmModule.forFeature([Device, Subnet, ApiKey, ScanReport])],
  controllers: [ScanController],
  providers: [ScanService],
  exports: [ScanService],
})
export class ScanModule {}
