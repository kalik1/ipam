import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { Vlan } from '../entities/vlan.entity';
import { CreateVlanDto, UpdateVlanDto } from './vlans.dto';
import { VlanDetail, VlansService } from './vlans.service';

@Controller('vlans')
export class VlansController {
  constructor(private readonly vlansService: VlansService) {}

  @Get()
  findAll(@Query('search') search?: string): Promise<Vlan[]> {
    return this.vlansService.findAll(search);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number): Promise<VlanDetail> {
    return this.vlansService.findById(id);
  }

  @Post()
  create(@Body() dto: CreateVlanDto): Promise<Vlan> {
    return this.vlansService.create(dto);
  }

  @Put(':vlanId')
  update(
    @Param('vlanId', ParseIntPipe) vlanId: number,
    @Body() dto: UpdateVlanDto,
  ): Promise<Vlan> {
    return this.vlansService.update(vlanId, dto);
  }

  @Delete(':vlanId')
  async remove(@Param('vlanId', ParseIntPipe) vlanId: number): Promise<void> {
    await this.vlansService.remove(vlanId);
  }
}
