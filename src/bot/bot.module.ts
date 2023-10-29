import { Module } from '@nestjs/common';
import { TradeService } from './trade.service';
import { OrderModule } from '../order/order.module';
import { BalanceModule } from '../balance/balance.module';
import { FileLogService } from '../log/filelog.service';
import { ExchangeModule } from '../exchange/exchange.module';
import { StrategyModule } from '../strategy/strategy.module';
import { UserModule } from '../user/user.module';
import { BotNest } from './botnest.service';
import { CacheModule } from '@nestjs/cache-manager';
import { BuyOrderCreatedListener } from './listeners/buyorder-created.listener';
import { EventEmitterModule } from '@nestjs/event-emitter';

@Module({
  imports: [    
    EventEmitterModule.forRoot(),
    StrategyModule,
    ExchangeModule,
    OrderModule,
    BalanceModule,
    UserModule,
    CacheModule.register(),
  ],
  controllers: [],
  providers: [FileLogService, TradeService, BotNest, BuyOrderCreatedListener],
  exports: [BotNest],
})
export class BotModule {}
