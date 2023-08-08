import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AccountService } from './account.service';
import { ApiService } from './api.service';
import { PairService } from './pair.service';
import { PublicApiService } from './publicApi.service';
import { Pair } from './entities/pair.entity';


@Module({
  imports: [TypeOrmModule.forFeature([Pair])],
  controllers: [],
  providers: [
    PublicApiService,    
    AccountService,
    PairService
  ],
  exports: [
    AccountService,
    PairService
  ]
})
export class ExchangeModule {}
