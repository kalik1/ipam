import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Subnet } from './subnet.entity';

@Entity('gateways')
export class Gateway {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 45 })
  ip: string;

  @Column({ type: 'integer' })
  subnetId: number;

  @ManyToOne(() => Subnet, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'subnetId' })
  subnet: Subnet;
}
