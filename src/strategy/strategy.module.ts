import { Module } from '@nestjs/common';
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
    StrategyService,
  ],
  exports: [StrategyService],
})
export class StrategyModule {}
