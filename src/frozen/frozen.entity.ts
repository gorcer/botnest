import {
  Column,
  CreateDateColumn,
  Double,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity()
export class Frozen {
  @PrimaryGeneratedColumn()
  id: number;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn({
    type: 'timestamp',
    default: () => 'now()',
    onUpdate: 'now()',
  })
  updated_at: Date;

  @Index()
  @Column({ type: 'int', default: 1 })
  account_id: number;

  @Index()
  @Column('varchar')
  currency: string;

  @Column({ type: 'decimal', default: 0 })
  amount: number;

  @Column({ type: 'decimal', default: 0 })
  amount_in_usd: number;

  @Column({ type: 'decimal', default: 0 })
  avg_rate: number;
}
