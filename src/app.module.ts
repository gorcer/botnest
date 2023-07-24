import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { OrderModule } from './order/order.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { Order } from './order/entities/order.entity';
import { BinanceModule } from './binance/binance.module';
import { BotModule } from './bot/bot.module';
import { ConfigModule } from '@nestjs/config';
import { Balance } from './balance/entities/balance.entity';
import { LogService } from './log.service';

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
      entities: [Order, Balance],
      synchronize: true,
      logging: true
    }),        
    BotModule
  ],
  controllers: [AppController],
  providers: [AppService, LogService],
})
export class AppModule {}
