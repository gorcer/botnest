import {
  BeforeInsert,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinTable,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Pair } from '../../exchange/entities/pair.entity';

export enum OrderSideEnum {
  BUY = 'buy',
  SELL = 'sell',
}

@Entity()
@Index([
  'rate',
  'createdAtSec',
  'amount1',
  'preclosed',
  'isActive',
  'currency1',
  'currency2',
])
export class Order {
  @PrimaryGeneratedColumn()
  id: number;

  @CreateDateColumn({
    type: 'timestamp',
    default: () => 'now()',
  })
  createdAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  closedAt: Date;

  @Column('int')
  createdAtSec: number;

  @Index()
  @Column({ type: 'int', default: 1 })
  accountId: number;

  @Column('varchar')
  extOrderId: string;

  @Index()
  @Column({ type: 'int', nullable: true })
  parentId: number;

  @Index()
  @Column({
    type: 'enum',
    enum: OrderSideEnum,
    default: OrderSideEnum.BUY,
  })
  side: OrderSideEnum;

  @Index()
  @Column({ type: 'int', default: 1, nullable: true })
  pairId: number;

  @Column({ type: 'varchar', default: 'BTC/BUSD' })
  pairName: string;

  @Column({ type: 'varchar' })
  currency1: string;

  @Column({ type: 'varchar' })
  currency2: string;

  @Column('decimal')
  rate: number;

  @Column('decimal')
  expectedRate: number;

  @Column('decimal')
  amount1: number;

  @Column('decimal')
  amount2: number;

  @Column('decimal')
  fee1: number;

  @Column('decimal')
  fee2: number;

  @Column({ type: 'decimal', default: 0 })
  fee: number;

  @Column({
    type: 'decimal',
    default: 0,
    comment: 'How much in close orders put',
  })
  preclosed: number;

  @Column({ type: 'decimal', default: 0, comment: 'How much filled' })
  filled: number;

  @Column({ type: 'decimal', default: 0, comment: 'How much really closed' })
  closed_amount: number;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @Column({ type: 'decimal', default: 0 })
  profit: number;

  @Column({ type: 'decimal', default: 0 })
  profit_in_usd: number;

  @Column({ type: 'decimal', default: 0 })
  amount2_in_usd: number;

  @Column({ type: 'decimal', default: 0 })
  fee_in_usd: number;

  @Column({ type: 'decimal', default: 0 })
  anualProfitPc: number;

  // @BeforeInsert()
  // beforeInsert() {
  //   this.createdAtSec = Math.floor(Date.now() / 1000)
  // }
}
