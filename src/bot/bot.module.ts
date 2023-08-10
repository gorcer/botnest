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
import { PairService } from '../exchange/pair.service';
import { ActiveOrdersAboveProfit } from '../analitics/activeOrdersAboveProfit.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Order } from '../order/entities/order.entity';
import { Balance } from '../balance/entities/balance.entity';
import { AccountsReadyToBuy } from '../analitics/accountsReadyToBuy.service';
import { AnaliticsModule } from '../analitics/analitics.module';


@Module({
  imports: [
    AnaliticsModule,
    ExchangeModule,
    OrderModule,
    BalanceModule,    
    TypeOrmModule.forFeature([Order, Balance])
  ],
  controllers: [],
  providers: [
    FileLogService,
    BotService, 
    BalanceService,  
    PublicApiService,    
    AccountService,
    LonelyTraderService,       
  ],
  exports: [LonelyTraderService],
})
export class BotModule {}
