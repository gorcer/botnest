import { Column, Double, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity()
export class Balance {
  @PrimaryGeneratedColumn()
  id: number;

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
