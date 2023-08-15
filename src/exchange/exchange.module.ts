import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AccountService } from '../user/account.service';
import { PairService } from './pair.service';
import { PublicApiService } from './publicApi.service';
import { Pair } from './entities/pair.entity';


@Module({
  imports: [TypeOrmModule.forFeature([Pair])],
  controllers: [],
  providers: [
    PublicApiService,        
    PairService
  ],
  exports: [    
    PairService, PublicApiService
  ]
})
export class ExchangeModule {}
