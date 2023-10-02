import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AccountService } from './account.service';
import { Account } from './entities/account.entity';
import { ExchangeModule } from '../exchange/exchange.module';

@Module({
  imports: [TypeOrmModule.forFeature([Account]), ExchangeModule],
  providers: [AccountService],
  exports: [TypeOrmModule, AccountService],
})
export class UserModule {}
