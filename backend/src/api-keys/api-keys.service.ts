import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { generateApiKey, hashApiKey } from '../lib/api-key';
import { ApiKey } from '../entities/api-key.entity';
import { CreateApiKeyDto } from './api-keys.dto';

export interface CreatedApiKeyResponse {
  id: number;
  name: string;
  key: string;
  keyPrefix: string;
  createdAt: Date;
  lastUsedAt: Date | null;
}

@Injectable()
export class ApiKeysService {
  constructor(
    @InjectRepository(ApiKey) private readonly apiKeyRepo: Repository<ApiKey>,
  ) {}

  findAll(): Promise<ApiKey[]> {
    return this.apiKeyRepo.find({
      order: { id: 'ASC' },
      select: {
        id: true,
        name: true,
        keyPrefix: true,
        createdAt: true,
        lastUsedAt: true,
      },
    });
  }

  async create(dto: CreateApiKeyDto): Promise<CreatedApiKeyResponse> {
    const key = generateApiKey();
    const apiKey = this.apiKeyRepo.create({
      name: dto.name,
      keyHash: hashApiKey(key),
      keyPrefix: key.slice(0, 8),
    });
    const saved = await this.apiKeyRepo.save(apiKey);
    return {
      id: saved.id,
      name: saved.name,
      key,
      keyPrefix: saved.keyPrefix,
      createdAt: saved.createdAt,
      lastUsedAt: saved.lastUsedAt,
    };
  }

  async remove(id: number): Promise<void> {
    const apiKey = await this.apiKeyRepo.findOne({ where: { id } });
    if (!apiKey) throw new NotFoundException('API key not found');
    await this.apiKeyRepo.remove(apiKey);
  }
}
