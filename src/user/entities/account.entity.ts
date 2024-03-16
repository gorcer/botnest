import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Exchange } from '../../exchange/entities/exchange.entity';

@Entity()
export class Account {
  @PrimaryGeneratedColumn()
  id: number;

  @CreateDateColumn()
  createdAt: Date;

  @Index()
  @Column('int')
  userId: number;

  @Column({ type: 'decimal', default: 0 })
  profit: number;

  @Column({ type: 'decimal', default: 0 })
  annualProfitPc: number;

  @Column({ type: 'varchar', nullable: true })
  apiKey: string;

  @Column({ type: 'varchar', nullable: true })
  secret: string;

  @Column({ type: 'varchar', nullable: true })
  password: string;

  @Index()
  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @Column({ type: 'boolean', default: false })
  is_connected: boolean;

  /** When need hide account from user (system account) */
  @Index()
  @Column({ type: 'boolean', default: true })
  is_visible: boolean;

  /** When you needs to restrict user for trading */
  @Index()
  @Column({ type: 'boolean', default: true })
  is_trading_allowed: boolean;

  @Index()
  @Column({ type: Date, nullable: true })
  deleted_at: Date;

  @Column({ type: 'int' })
  error_code: number;

  @ManyToOne(() => Exchange, { nullable: true })
  @JoinColumn({ name: 'exchange_id' })
  exchange: Exchange;

  @Column('int', { nullable: true }) // Поле для хранения идентификатора связанной сущности
  exchange_id: number;
}
