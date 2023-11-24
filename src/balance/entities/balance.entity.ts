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
export class Balance {
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
  accountId: number;

  @Index()
  @Column('varchar')
  currency: string;

  @Column({ type: 'decimal', default: 0 })
  amount: number;

  @Column({ type: 'decimal', default: 0 })
  inOrders: number;

  @Index()
  @Column({ type: 'decimal', default: 0 })
  available: number;
}
