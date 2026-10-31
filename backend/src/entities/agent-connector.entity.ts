import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { Connector } from './connector.entity';

export type AssignmentStatus = 'ok' | 'error' | 'skipped' | 'sent';

@Entity('agent_connectors')
@Unique(['agentName', 'connectorId'])
export class AgentConnector {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 100 })
  agentName: string;

  @Column({ type: 'integer' })
  connectorId: number;

  @ManyToOne(() => Connector, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'connectorId' })
  connector: Connector;

  @Column({ type: 'varchar', length: 100 })
  schedule: string;

  @Column({ type: 'boolean', default: true })
  enabled: boolean;

  @Column({ type: 'datetime', nullable: true })
  lastRunAt: Date | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  lastStatus: AssignmentStatus | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  lastError: string | null;

  @Column({ type: 'datetime', nullable: true })
  nextRunAt: Date | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  commandRef: string | null;
}
