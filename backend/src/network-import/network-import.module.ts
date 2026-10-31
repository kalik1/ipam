import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Device } from '../entities/device.entity';
import { DhcpPool } from '../entities/dhcp-pool.entity';
import { Gateway } from '../entities/gateway.entity';
import { Subnet } from '../entities/subnet.entity';
import { Vlan } from '../entities/vlan.entity';
import { NetworkImportService } from './network-import.service';

@Module({
  imports: [TypeOrmModule.forFeature([Vlan, Subnet, Gateway, Device, DhcpPool])],
  providers: [NetworkImportService],
  exports: [NetworkImportService],
})
export class NetworkImportModule {}
