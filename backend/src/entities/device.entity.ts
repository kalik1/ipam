import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Subnet } from './subnet.entity';

export type DeviceStatus = 'online' | 'offline';

@Entity('devices')
export class Device {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 45, unique: true })
  ip: string;

  @Column({ type: 'varchar', length: 17, default: '' })
  mac: string;

  @Column({ type: 'varchar', length: 100, default: '' })
  hostname: string;

  @Column({ type: 'varchar', length: 100, default: '' })
  vendor: string;

  @Column({ type: 'integer', nullable: true })
  subnetId: number | null;

  @ManyToOne(() => Subnet, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'subnetId' })
  subnet: Subnet | null;

  @Column({ type: 'varchar', length: 10, default: 'online' })
  status: DeviceStatus;

  @Column({ type: 'datetime' })
  lastSeen: Date;

  @Column({ type: 'varchar', length: 255, default: '' })
  notes: string;

  @CreateDateColumn({ type: 'datetime' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'datetime' })
  updatedAt: Date;
}
