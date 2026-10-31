import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ApiKey } from '../entities/api-key.entity';
import { NetworkImportModule } from '../network-import/network-import.module';
import { ScanModule } from '../scan/scan.module';
import { AgentWsController } from './agent-ws.controller';
import { AgentWsService } from './agent-ws.service';

@Module({
  imports: [TypeOrmModule.forFeature([ApiKey]), ScanModule, NetworkImportModule],
  controllers: [AgentWsController],
  providers: [AgentWsService],
  exports: [AgentWsService],
})
export class AgentWsModule {}
