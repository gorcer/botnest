import {
  Column,
  CreateDateColumn,
  Double,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity("balances")
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
  account_id: number;

  @Index()
  @Column('varchar')
  currency: string;

  @Column({ type: 'decimal', default: 0 })
  amount: number;

  @Column({ type: 'decimal', default: 0 })
  in_orders: number;

  @Column({ type: 'decimal', default: 0 })
  for_fee: number;

  @Index()
  @Column({ type: 'decimal', default: 0 })
  available: number;
}
