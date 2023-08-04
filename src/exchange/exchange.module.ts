import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AccountService } from './account.service';
import { ApiService } from './api.service';


@Module({
  imports: [TypeOrmModule.forFeature([])],
  controllers: [],
  providers: [AccountService],
  exports: [AccountService]
})
export class ExchangeModule {}
