import { Module } from '@nestjs/common';
import { StrategyService } from './strategy.service';
import { BalanceModule } from '../balance/balance.module';
import { OrderModule } from '../order/order.module';
import { FillCellsStrategyService } from './buyFillCellsStrategy/fillCellsStrategy.service';
import { FillCells } from './buyFillCellsStrategy/fillCells.entity';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ExchangeModule } from '../exchange/exchange.module';

@Module({
  imports: [
    OrderModule,
    BalanceModule,
    ExchangeModule,
    TypeOrmModule.forFeature([FillCells]),
  ],
  controllers: [],
  providers: [StrategyService, FillCellsStrategyService],
  exports: [StrategyService, FillCellsStrategyService],
})
export class StrategyModule {}
