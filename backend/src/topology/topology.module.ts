import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Device } from '../entities/device.entity';
import { Subnet } from '../entities/subnet.entity';
import { Vlan } from '../entities/vlan.entity';
import { TopologyController } from './topology.controller';
import { TopologyService } from './topology.service';

@Module({
  imports: [TypeOrmModule.forFeature([Vlan, Subnet, Device])],
  controllers: [TopologyController],
  providers: [TopologyService],
})
export class TopologyModule {}
