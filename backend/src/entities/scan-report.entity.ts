import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('scan_reports')
export class ScanReport {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 100 })
  agent: string;

  @Column({ type: 'varchar', length: 50, default: '' })
  platform: string;

  @Column({ type: 'integer' })
  deviceCount: number;

  @Column({ type: 'datetime' })
  receivedAt: Date;

  @Column({ type: 'simple-json', default: '[]' })
  subnetIds: number[];
}
