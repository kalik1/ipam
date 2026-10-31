import {
  BadRequestException,
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
import { Device, DeviceStatus } from '../entities/device.entity';
import { CreateDeviceDto, UpdateDeviceDto } from './devices.dto';
import { DevicesService } from './devices.service';

const STATUSES: DeviceStatus[] = ['online', 'offline'];

@Controller('devices')
export class DevicesController {
  constructor(private readonly devicesService: DevicesService) {}

  @Get()
  findAll(
    @Query('subnetId') subnetId?: string,
    @Query('status') status?: string,
    @Query('search') search?: string,
  ): Promise<Device[]> {
    return this.devicesService.findAll(
      parseIdParam(subnetId, 'subnetId'),
      parseStatus(status),
      search,
    );
  }

  @Post()
  create(@Body() dto: CreateDeviceDto): Promise<Device> {
    return this.devicesService.create(dto);
  }

  @Put(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateDeviceDto,
  ): Promise<Device> {
    return this.devicesService.update(id, dto);
  }

  @Delete(':id')
  async remove(@Param('id', ParseIntPipe) id: number): Promise<void> {
    await this.devicesService.remove(id);
  }
}

function parseIdParam(value: string | undefined, name: string): number | undefined {
  if (value === undefined) return undefined;
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) {
    throw new BadRequestException(`${name} must be an integer`);
  }
  return parsed;
}

function parseStatus(value: string | undefined): DeviceStatus | undefined {
  if (value === undefined) return undefined;
  if (!STATUSES.includes(value as DeviceStatus)) {
    throw new BadRequestException("status must be 'online' or 'offline'");
  }
  return value as DeviceStatus;
}
