import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Vlan } from './vlan.entity';
import { Device } from './device.entity';
import { Gateway } from './gateway.entity';
import { DhcpPool } from './dhcp-pool.entity';

@Entity('subnets')
export class Subnet {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 43, unique: true })
  cidr: string;

  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({ type: 'boolean', default: false })
  includeFirstLast: boolean;

  @Column({ type: 'integer', nullable: true })
  vlanId: number | null;

  @ManyToOne(() => Vlan, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'vlanId' })
  vlan: Vlan | null;

  @OneToMany(() => Device, (device) => device.subnet)
  devices: Device[];

  @OneToMany(() => Gateway, (gateway) => gateway.subnet, { cascade: true })
  gateways: Gateway[];

  @OneToMany(() => DhcpPool, (pool) => pool.subnet, { cascade: true })
  dhcpPools: DhcpPool[];

  @Column({ type: 'varchar', length: 255, default: '' })
  description: string;

  @Column({ type: 'varchar', length: 255, default: '' })
  domainName: string;

  @Column({ type: 'varchar', length: 500, default: '' })
  dnsServers: string;

  @Column({ type: 'varchar', length: 500, default: '' })
  ntpServers: string;

  @CreateDateColumn({ type: 'datetime' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'datetime' })
  updatedAt: Date;
}
