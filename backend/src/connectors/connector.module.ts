import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AgentWsModule } from '../agent-ws/agent-ws.module';
import { AgentConnector } from '../entities/agent-connector.entity';
import { Connector } from '../entities/connector.entity';
import {
  AgentConnectorsController,
  ConnectorController,
} from './connector.controller';
import { ConnectorScheduler } from './connector.scheduler';
import { ConnectorService } from './connector.service';

@Module({
  imports: [TypeOrmModule.forFeature([Connector, AgentConnector]), AgentWsModule],
  controllers: [ConnectorController, AgentConnectorsController],
  providers: [ConnectorService, ConnectorScheduler],
})
export class ConnectorModule {}
