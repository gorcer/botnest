import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Order } from './order/entities/order.entity';
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
      // logging: true
    }),        
    BotModule
  ],
  controllers: [],
  providers: [ LogService],
})
export class AppModule {}
