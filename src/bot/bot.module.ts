import { Module } from '@nestjs/common';
import { BotService } from './bot.service';
import { OrderModule } from '../order/order.module';
import { BalanceService } from '../balance/balance.service';
import { BalanceModule } from '../balance/balance.module';
import { FileLogService } from '../log/filelog.service';
import { PublicApiService } from '../exchange/publicApi.service';
import { ExchangeModule } from '../exchange/exchange.module';
import { AccountService } from '../exchange/account.service';
import { LonelyTraderService } from './lonelyTrader.service';


@Module({
  imports: [
    OrderModule,
    BalanceModule,
    ExchangeModule
  ],
  controllers: [],
  providers: [
    FileLogService,
    BotService, 
    BalanceService,  
    PublicApiService,    
    AccountService,
    LonelyTraderService
  ],
  exports: [BotService, LonelyTraderService],
})
export class BotModule {}
