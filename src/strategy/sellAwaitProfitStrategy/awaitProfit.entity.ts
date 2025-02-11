import { Column, Entity } from 'typeorm';
import { BaseStrategyModel } from '../baseStrategyModel.entity';

@Entity('strategy_sell_awaitProfit')
export class AwaitProfit extends BaseStrategyModel {
  @Column({ type: 'int', nullable: true })
  pairId: number;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @Column({ type: 'decimal', default: 200 })
  minProfit: number;

  @Column({ type: 'decimal', default: 30 })
  minAnnualProfit: number;
}
