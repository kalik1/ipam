import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
  Put,
} from '@nestjs/common';
import { AgentConnector } from '../entities/agent-connector.entity';
import { Connector } from '../entities/connector.entity';
import {
  AssignConnectorDto,
  CreateConnectorDto,
  MoveAssignmentDto,
  UpdateAssignmentDto,
  UpdateConnectorDto,
} from './connector.dto';
import { ConnectorService } from './connector.service';

@Controller('connectors')
export class ConnectorController {
  constructor(private readonly connectorService: ConnectorService) {}

  @Get()
  list(): Promise<Connector[]> {
    return this.connectorService.listConnectors();
  }

  @Post()
  create(@Body() dto: CreateConnectorDto): Promise<Connector> {
    return this.connectorService.createConnector(dto);
  }

  @Put(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateConnectorDto,
  ): Promise<Connector> {
    return this.connectorService.updateConnector(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id', ParseIntPipe) id: number): Promise<void> {
    await this.connectorService.deleteConnector(id);
  }
}

@Controller('agents')
export class AgentConnectorsController {
  constructor(private readonly connectorService: ConnectorService) {}

  @Get(':name/connectors')
  list(@Param('name') name: string): Promise<AgentConnector[]> {
    return this.connectorService.listAssignments(name);
  }

  @Post(':name/connectors')
  assign(
    @Param('name') name: string,
    @Body() dto: AssignConnectorDto,
  ): Promise<AgentConnector> {
    return this.connectorService.assign(name, dto);
  }

  @Put(':name/connectors/:connectorId')
  update(
    @Param('name') name: string,
    @Param('connectorId', ParseIntPipe) connectorId: number,
    @Body() dto: UpdateAssignmentDto,
  ): Promise<AgentConnector> {
    return this.connectorService.updateAssignment(name, connectorId, dto);
  }

  @Delete(':name/connectors/:connectorId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @Param('name') name: string,
    @Param('connectorId', ParseIntPipe) connectorId: number,
  ): Promise<void> {
    await this.connectorService.deleteAssignment(name, connectorId);
  }

  @Post(':name/connectors/:connectorId/move')
  move(
    @Param('name') name: string,
    @Param('connectorId', ParseIntPipe) connectorId: number,
    @Body() dto: MoveAssignmentDto,
  ): Promise<AgentConnector> {
    return this.connectorService.moveAssignment(name, connectorId, dto.toAgent);
  }

  @Post(':name/connectors/:connectorId/run')
  @HttpCode(HttpStatus.OK)
  run(
    @Param('name') name: string,
    @Param('connectorId', ParseIntPipe) connectorId: number,
  ): Promise<{ id: string }> {
    return this.connectorService.runNow(name, connectorId);
  }
}
