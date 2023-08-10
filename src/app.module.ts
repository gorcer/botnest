import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Order } from './order/entities/order.entity';
import { BotModule } from './bot/bot.module';
import { ConfigModule } from '@nestjs/config';
import { Balance } from './balance/entities/balance.entity';
import { FileLogService } from './log/filelog.service';
import { Pair } from './exchange/entities/pair.entity';
import { BalanceLog } from './balance/entities/balanceLog.entity';

@Module({
  imports: [    
    ConfigModule.forRoot(),
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: 'localhost',
      port: parseInt(process.env.DB_PORT),
      username: process.env.DB_LOGIN,
      password:  process.env.DB_PASS,
      database:  process.env.DB_NAME,
      entities: [Pair, Order, Balance, BalanceLog],
      synchronize: true,
      logging: process.env.DB_LOGGING == 'true'
    }),        
    BotModule
  ],
  controllers: [],
  providers: [ FileLogService],
})
export class AppModule {}
