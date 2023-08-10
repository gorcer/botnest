import { Module } from '@nestjs/common';
import { ActiveOrdersAboveProfit } from './activeOrdersAboveProfit.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Order } from '../order/entities/order.entity';
import { Balance } from '../balance/entities/balance.entity';
import { AccountsReadyToBuy } from './accountsReadyToBuy.service';


@Module({
  imports: [      
    TypeOrmModule.forFeature([Order, Balance])
  ],
  controllers: [],
  providers: [     
    ActiveOrdersAboveProfit, 
    AccountsReadyToBuy,
  ],
  exports: [AccountsReadyToBuy, ActiveOrdersAboveProfit],
})
export class AnaliticsModule {}
