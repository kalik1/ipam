import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Subnet } from './subnet.entity';

@Entity('dhcp_pools')
export class DhcpPool {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 100, default: '' })
  name: string;

  @Column({ type: 'varchar', length: 45 })
  startIp: string;

  @Column({ type: 'varchar', length: 45 })
  endIp: string;

  @Column({ type: 'integer' })
  subnetId: number;

  @ManyToOne(() => Subnet, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'subnetId' })
  subnet: Subnet;
}
