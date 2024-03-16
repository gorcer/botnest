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
import { EventEmitterModule } from '@nestjs/event-emitter';
import { TradeCheckService } from './tradeCheck.service';
import { FeeService } from './fee.service';
import { BuyOrderService } from './buyOrder.service';
import { CloseOrderService } from './closeOrder.service';
import { FrozenModule } from '../frozen/frozen.module';

@Module({
  imports: [
    EventEmitterModule.forRoot(),
    StrategyModule,
    ExchangeModule,
    OrderModule,
    BalanceModule,
    UserModule,
    CacheModule.register(),
    StrategyModule,
    FrozenModule
  ],
  controllers: [],
  providers: [FileLogService, TradeService, BotNest, TradeCheckService, FeeService, BuyOrderService, CloseOrderService],
  exports: [BotNest],
})
export class BotModule { }
