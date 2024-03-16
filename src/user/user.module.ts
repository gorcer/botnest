import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AccountService } from './account.service';
import { Account } from './entities/account.entity';
import { ExchangeModule } from '../exchange/exchange.module';
import { FileLogService } from '../log/filelog.service';
import { CacheModule } from '@nestjs/cache-manager';

@Module({
  imports: [
    CacheModule.register(),
    TypeOrmModule.forFeature([Account]),
    ExchangeModule,
  ],
  providers: [FileLogService, AccountService],
  exports: [TypeOrmModule, AccountService],
})
export class UserModule {}
