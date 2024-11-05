import {
  Column,
  Entity,
  JoinColumn,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Account } from '../../user/entities/account.entity';
import { Pair } from './pair.entity';

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

  @Column({ type: 'integer', default: 0 })
  accounts_count: number;

  @Column({ type: 'varchar', nullable: true })
  auth_attributes: string;

  @Column({ type: 'varchar', nullable: true })
  register_link: string;

  @Column({ type: 'boolean', default: false })
  reload_order_on_create: boolean;


  @OneToMany(() => Account, (account) => account.exchange)
  @JoinColumn({ name: 'exchange_id' })
  accounts: Account[];

  @OneToMany(() => Pair, (pair) => pair.exchange)
  @JoinColumn({ name: 'exchange_id' })
  pairs: Pair[];
}
