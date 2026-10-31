import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Device } from '../entities/device.entity';
import { Subnet } from '../entities/subnet.entity';
import { Vlan } from '../entities/vlan.entity';
import { Gateway } from '../entities/gateway.entity';
import { DhcpPool } from '../entities/dhcp-pool.entity';
import { SubnetsController } from './subnets.controller';
import { DhcpPoolsController } from './dhcp-pools.controller';
import { SubnetsService } from './subnets.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Subnet, Vlan, Device, Gateway, DhcpPool]),
  ],
  controllers: [SubnetsController, DhcpPoolsController],
  providers: [SubnetsService],
})
export class SubnetsModule {}
