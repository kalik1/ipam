import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ApiKey } from '../entities/api-key.entity';
import { Connector } from '../entities/connector.entity';
import { Device } from '../entities/device.entity';
import { DhcpPool } from '../entities/dhcp-pool.entity';
import { Gateway } from '../entities/gateway.entity';
import { Subnet } from '../entities/subnet.entity';
import { User } from '../entities/user.entity';
import { Vlan } from '../entities/vlan.entity';
import { SeedService } from './seed.service';

@Module({
  imports: [TypeOrmModule.forFeature([User, Vlan, Subnet, Device, Gateway, DhcpPool, ApiKey, Connector])],
  providers: [SeedService],
})
export class SeedModule {}
