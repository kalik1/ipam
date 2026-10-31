import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { CronJob, CronTime } from 'cron';
import { Repository } from 'typeorm';
import { AgentWsService } from '../agent-ws/agent-ws.service';
import { AgentConnector } from '../entities/agent-connector.entity';
import { Connector } from '../entities/connector.entity';
import {
  AssignConnectorDto,
  CreateConnectorDto,
  UpdateAssignmentDto,
  UpdateConnectorDto,
} from './connector.dto';

@Injectable()
export class ConnectorService {
  constructor(
    @InjectRepository(Connector)
    private readonly connectorRepo: Repository<Connector>,
    @InjectRepository(AgentConnector)
    private readonly assignmentRepo: Repository<AgentConnector>,
    private readonly agentWsService: AgentWsService,
  ) {}

  listConnectors(): Promise<Connector[]> {
    return this.connectorRepo.find({ order: { id: 'ASC' } });
  }

  async createConnector(dto: CreateConnectorDto): Promise<Connector> {
    this.assertObjectConfig(dto.config);
    const connector = this.connectorRepo.create({
      name: dto.name,
      label: dto.label ?? '',
      config: dto.config,
    });
    return this.connectorRepo.save(connector);
  }

  async updateConnector(id: number, dto: UpdateConnectorDto): Promise<Connector> {
    const connector = await this.connectorRepo.findOne({ where: { id } });
    if (!connector) throw new NotFoundException('Connector not found');
    if (dto.name !== undefined) connector.name = dto.name;
    if (dto.label !== undefined) connector.label = dto.label;
    if (dto.config !== undefined) {
      this.assertObjectConfig(dto.config);
      connector.config = dto.config;
    }
    return this.connectorRepo.save(connector);
  }

  async deleteConnector(id: number): Promise<void> {
    const connector = await this.connectorRepo.findOne({ where: { id } });
    if (!connector) throw new NotFoundException('Connector not found');
    await this.connectorRepo.remove(connector);
  }

  listAssignments(agentName: string): Promise<AgentConnector[]> {
    return this.assignmentRepo.find({
      where: { agentName },
      relations: ['connector'],
      order: { id: 'ASC' },
    });
  }

  async assign(
    agentName: string,
    dto: AssignConnectorDto,
  ): Promise<AgentConnector> {
    const connector = await this.connectorRepo.findOne({
      where: { id: dto.connectorId },
    });
    if (!connector) throw new NotFoundException('Connector not found');
    this.assertValidCron(dto.schedule);
    const existing = await this.assignmentRepo.findOne({
      where: { agentName, connectorId: dto.connectorId },
    });
    if (existing) {
      throw new ConflictException('Connector already assigned to agent');
    }
    const assignment = this.assignmentRepo.create({
      agentName,
      connectorId: dto.connectorId,
      connector,
      schedule: dto.schedule,
      enabled: dto.enabled ?? true,
      lastRunAt: null,
      lastStatus: null,
      lastError: null,
      nextRunAt: this.nextDate(dto.schedule),
      commandRef: null,
    });
    return this.assignmentRepo.save(assignment);
  }

  async updateAssignment(
    agentName: string,
    connectorId: number,
    dto: UpdateAssignmentDto,
  ): Promise<AgentConnector> {
    const assignment = await this.findAssignment(agentName, connectorId);
    if (dto.schedule !== undefined) {
      this.assertValidCron(dto.schedule);
      assignment.schedule = dto.schedule;
      assignment.nextRunAt = this.nextDate(dto.schedule);
    }
    if (dto.enabled !== undefined) assignment.enabled = dto.enabled;
    return this.assignmentRepo.save(assignment);
  }

  async deleteAssignment(agentName: string, connectorId: number): Promise<void> {
    const assignment = await this.findAssignment(agentName, connectorId);
    await this.assignmentRepo.remove(assignment);
  }

  async moveAssignment(
    agentName: string,
    connectorId: number,
    toAgent: string,
  ): Promise<AgentConnector> {
    const assignment = await this.findAssignment(agentName, connectorId);
    const existing = await this.assignmentRepo.findOne({
      where: { agentName: toAgent, connectorId },
    });
    if (existing) {
      throw new ConflictException('Connector already assigned to agent');
    }
    assignment.agentName = toAgent;
    assignment.nextRunAt = this.nextDate(assignment.schedule);
    return this.assignmentRepo.save(assignment);
  }

  async runNow(
    agentName: string,
    connectorId: number,
  ): Promise<{ id: string }> {
    const assignment = await this.findAssignment(agentName, connectorId);
    const connector = assignment.connector;
    const { id } = this.agentWsService.sendCommand(agentName, {
      action: 'run_connector',
      connector: connector.name,
      params: connector.config,
    });
    assignment.lastRunAt = new Date();
    assignment.lastStatus = 'sent';
    assignment.lastError = null;
    assignment.commandRef = id;
    await this.assignmentRepo.save(assignment);
    return { id };
  }

  nextDate(schedule: string): Date {
    return new CronJob(schedule, () => {}, null, false).nextDate().toJSDate();
  }

  async tick(): Promise<void> {
    const now = new Date();
    const assignments = await this.assignmentRepo.find({
      where: { enabled: true },
      relations: ['connector'],
    });
    for (const assignment of assignments) {
      if (assignment.nextRunAt === null) {
        assignment.nextRunAt = this.nextDate(assignment.schedule);
      } else if (now >= assignment.nextRunAt) {
        try {
          const connector = assignment.connector;
          const { id } = this.agentWsService.sendCommand(
            assignment.agentName,
            {
              action: 'run_connector',
              connector: connector.name,
              params: connector.config,
            },
          );
          assignment.lastRunAt = now;
          assignment.lastStatus = 'sent';
          assignment.lastError = null;
          assignment.commandRef = id;
        } catch {
          assignment.lastStatus = 'skipped';
          assignment.lastError = 'agent not connected';
        }
        assignment.nextRunAt = this.nextDate(assignment.schedule);
      }
      await this.assignmentRepo.save(assignment);
    }
    await this.resolvePendingResults();
  }

  private async resolvePendingResults(): Promise<void> {
    const pending = await this.assignmentRepo.find({
      where: { lastStatus: 'sent' },
    });
    for (const assignment of pending) {
      if (!assignment.commandRef) continue;
      const result = this.agentWsService.getResultById(
        assignment.commandRef,
      );
      if (!result) continue;
      assignment.lastStatus = result.ok ? 'ok' : 'error';
      assignment.lastError = result.ok ? null : (result.error ?? 'unknown');
      await this.assignmentRepo.save(assignment);
    }
  }

  private assertValidCron(schedule: string): void {
    const validation = CronTime.validateCronExpression(schedule);
    if (!validation.valid) {
      throw new BadRequestException('Invalid cron expression');
    }
  }

  private assertObjectConfig(config: unknown): void {
    if (!config || typeof config !== 'object' || Array.isArray(config)) {
      throw new BadRequestException('config must be an object');
    }
  }

  private async findAssignment(
    agentName: string,
    connectorId: number,
  ): Promise<AgentConnector> {
    const assignment = await this.assignmentRepo.findOne({
      where: { agentName, connectorId },
      relations: ['connector'],
    });
    if (!assignment) throw new NotFoundException('Assignment not found');
    return assignment;
  }
}
