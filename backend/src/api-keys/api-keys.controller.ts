import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
} from '@nestjs/common';
import { ApiKey } from '../entities/api-key.entity';
import {
  ApiKeysService,
  CreatedApiKeyResponse,
} from './api-keys.service';
import { CreateApiKeyDto } from './api-keys.dto';

@Controller('api-keys')
export class ApiKeysController {
  constructor(private readonly apiKeysService: ApiKeysService) {}

  @Get()
  findAll(): Promise<ApiKey[]> {
    return this.apiKeysService.findAll();
  }

  @Post()
  create(@Body() dto: CreateApiKeyDto): Promise<CreatedApiKeyResponse> {
    return this.apiKeysService.create(dto);
  }

  @Delete(':id')
  async remove(@Param('id', ParseIntPipe) id: number): Promise<void> {
    await this.apiKeysService.remove(id);
  }
}
