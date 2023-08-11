import { Module } from '@nestjs/common';
import { AwaitProfitStrategy } from './sellAwaitProfitStrategy/awaitProfitStrategy.strategy';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Order } from '../order/entities/order.entity';
import { Balance } from '../balance/entities/balance.entity';
import { FillCellsStrategy } from './buyFillCellsStrategy/fillCellsStrategy.strategy';
import { StrategyService } from './strategy.service';
import { BalanceModule } from '../balance/balance.module';
import { OrderModule } from '../order/order.module';


@Module({
  imports: [      
    OrderModule,
    BalanceModule
  ],
  controllers: [],
  providers: [     
    FillCellsStrategy, 
    AwaitProfitStrategy,
    StrategyService,
  ],
  exports: [FillCellsStrategy, AwaitProfitStrategy, StrategyService],
})
export class StrategyModule {}
