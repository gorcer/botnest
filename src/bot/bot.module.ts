import { Module } from '@nestjs/common';
import { BotService } from './bot.service';
import { OrderModule } from '../order/order.module';
import { BalanceService } from '../balance/balance.service';
import { ApiService } from '../exchange/api.service';
import { BalanceModule } from '../balance/balance.module';
import { LogService } from '../log.service';


@Module({
  imports: [
    OrderModule,
    BalanceModule,
  ],
  controllers: [],
  providers: [
    LogService,
    BotService, 
    BalanceService,    
    ApiService,    
  ],
  exports: [BotService],
})
export class BotModule {}
