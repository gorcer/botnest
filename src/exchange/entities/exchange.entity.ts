import {
  Column,
  Entity,
  JoinColumn,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Account } from '../../user/entities/account.entity';

@Entity()
export class Exchange {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar' })
  title: string;

  @Column({ type: 'varchar' })
  exchange_name: string;

  @Column({ type: 'boolean', default: false })
  test_mode: boolean;

  @Column({ type: 'boolean', default: true })
  is_active: boolean;

  @OneToMany(() => Account, (account) => account.exchange)
  @JoinColumn({ name: 'exchange_id' })
  accounts: Account[];
}
