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

@Module({
  imports: [
    StrategyModule,
    ExchangeModule,
    OrderModule,
    BalanceModule,
    UserModule,
    CacheModule.register(),
  ],
  controllers: [],
  providers: [FileLogService, TradeService, BotNest],
  exports: [BotNest],
})
export class BotModule {}
