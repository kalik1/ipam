import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
} from '@nestjs/common';
import {
  AgentInfo,
  AgentWsService,
  StoredResult,
} from './agent-ws.service';
import { AgentCommandDto } from './agent-ws.dto';

@Controller('agents')
export class AgentWsController {
  constructor(private readonly agentWsService: AgentWsService) {}

  @Get()
  list(): AgentInfo[] {
    return this.agentWsService.listAgents();
  }

  @Post(':name/commands')
  sendCommand(
    @Param('name') name: string,
    @Body() dto: AgentCommandDto,
  ): { id: string } {
    return this.agentWsService.sendCommand(name, dto);
  }

  @Get(':name/results')
  getLatestResult(@Param('name') name: string): StoredResult {
    const result = this.agentWsService.getLatestResult(name);
    if (!result) throw new NotFoundException('No result for agent');
    return result;
  }
}
