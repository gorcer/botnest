import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BotModule } from './bot/bot.module';
import { ConfigModule } from '@nestjs/config';
import { FileLogService } from './log/filelog.service';
import { Entities } from './all.entities';
import { BotNest } from './bot/botnest.service';
import { DaemonService } from './daemon.service';


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
      entities: Entities,      
      synchronize: true,
      logging: process.env.DB_LOGGING == 'true'
    }),        
    BotModule
  ],
  controllers: [],
  providers: [ 
    FileLogService,
    DaemonService    
  ],
  exports: [   
  ]
})
export class BotnestModule {
  constructor() {
    process.env.TZ = process.env.TIMEZONE
  }
}
