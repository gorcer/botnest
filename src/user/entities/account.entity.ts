import {
  Column,
  CreateDateColumn,
  Entity,
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

  @Column('int')
  userId: number;

  @Column({ type: 'decimal', default: 0 })
  profit: number;

  @Column({ type: 'varchar', nullable: true })
  apiKey: string;

  @Column({ type: 'varchar', nullable: true })
  secret: string;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @Column({ type: Date, nullable: true })
  deleted_at: Date;

  @ManyToOne(() => Exchange, {nullable: true})
  @JoinColumn({ name: 'exchange_id' })
  exchange: Exchange;

  
  // @Column('int', { nullable: true }) // Поле для хранения идентификатора связанной сущности
  // exchange_id: number;
}
