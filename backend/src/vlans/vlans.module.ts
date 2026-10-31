import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Device } from '../entities/device.entity';
import { Subnet } from '../entities/subnet.entity';
import { Vlan } from '../entities/vlan.entity';
import { VlansController } from './vlans.controller';
import { VlansService } from './vlans.service';

@Module({
  imports: [TypeOrmModule.forFeature([Vlan, Subnet, Device])],
  controllers: [VlansController],
  providers: [VlansService],
})
export class VlansModule {}
