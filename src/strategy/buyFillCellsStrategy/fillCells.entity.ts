import { Column, Entity } from 'typeorm';
import { BaseStrategyModel } from '../baseStrategyModel.entity';

@Entity('strategy_buy_fillCells')
export class FillCells extends BaseStrategyModel {
  @Column({ type: 'int', default: 1 })
  pairId: number;

  @Column({ type: 'decimal', default: 0.001 })
  orderAmount: number;

  @Column({ type: 'decimal', default: 0 })
  risk: number;

  @Column({ type: 'decimal', default: 50 })
  cellSize: number;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @Column({ type: 'decimal', default: 1 })
  minRate: any;
}
