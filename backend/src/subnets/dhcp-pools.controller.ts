import {
  Body,
  Controller,
  Delete,
  Param,
  ParseIntPipe,
  Put,
} from '@nestjs/common';
import { DhcpPoolResponse } from '../lib/subnet-response';
import { SubnetsService } from './subnets.service';
import { UpdateDhcpPoolDto } from './subnets.dto';

@Controller('dhcp-pools')
export class DhcpPoolsController {
  constructor(private readonly subnetsService: SubnetsService) {}

  @Put(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateDhcpPoolDto,
  ): Promise<DhcpPoolResponse> {
    return this.subnetsService.updatePool(id, dto);
  }

  @Delete(':id')
  async remove(@Param('id', ParseIntPipe) id: number): Promise<void> {
    await this.subnetsService.deletePool(id);
  }
}
