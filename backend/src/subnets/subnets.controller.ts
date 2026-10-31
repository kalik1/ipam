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
import { DhcpPoolResponse, SubnetResponse } from '../lib/subnet-response';
import { SubnetDetail, SubnetsService } from './subnets.service';
import {
  CreateDhcpPoolDto,
  CreateSubnetDto,
  UpdateSubnetDto,
} from './subnets.dto';

@Controller('subnets')
export class SubnetsController {
  constructor(private readonly subnetsService: SubnetsService) {}

  @Get()
  findAll(
    @Query('vlanId') vlanId?: string,
    @Query('search') search?: string,
  ): Promise<SubnetResponse[]> {
    return this.subnetsService.findAll(
      parseIdParam(vlanId, 'vlanId'),
      search,
    );
  }

  @Get(':id/dhcp-pools')
  findPools(@Param('id', ParseIntPipe) id: number): Promise<DhcpPoolResponse[]> {
    return this.subnetsService.findPools(id);
  }

  @Post(':id/dhcp-pools')
  createPool(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CreateDhcpPoolDto,
  ): Promise<DhcpPoolResponse> {
    return this.subnetsService.createPool(id, dto);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number): Promise<SubnetDetail> {
    return this.subnetsService.findById(id);
  }

  @Post()
  create(@Body() dto: CreateSubnetDto): Promise<SubnetResponse> {
    return this.subnetsService.create(dto);
  }

  @Put(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateSubnetDto,
  ): Promise<SubnetResponse> {
    return this.subnetsService.update(id, dto);
  }

  @Delete(':id')
  async remove(@Param('id', ParseIntPipe) id: number): Promise<void> {
    await this.subnetsService.remove(id);
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
