import { Module } from '@nestjs/common';
import { BotService } from './bot.service';
import { OrderModule } from '../order/order.module';
import { BalanceService } from '../balance/balance.service';
import { BalanceModule } from '../balance/balance.module';
import { FileLogService } from '../log/filelog.service';
import { PublicApiService } from '../exchange/publicApi.service';
import { ExchangeModule } from '../exchange/exchange.module';
import { AccountService } from '../user/account.service';
import { LonelyTraderService } from './lonelyTrader.service';
import { PairService } from '../exchange/pair.service';
import { AwaitProfitStrategy } from '../strategy/sellAwaitProfitStrategy/awaitProfitStrategy.strategy';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Order } from '../order/entities/order.entity';
import { Balance } from '../balance/entities/balance.entity';
import { FillCellsStrategy } from '../strategy/buyFillCellsStrategy/fillCellsStrategy.strategy';
import { StrategyModule } from '../strategy/strategy.module';
import { UserModule } from '../user/user.module';
import { Account } from '../user/entities/account.entity';


@Module({
  imports: [
    StrategyModule,
    ExchangeModule,
    OrderModule,
    BalanceModule, 
    UserModule,       
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
