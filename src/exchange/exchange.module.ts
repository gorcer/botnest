import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AccountService } from '../user/account.service';
import { PairService } from './pair.service';
import { PublicApiService } from './publicApi.service';
import { Pair } from './entities/pair.entity';
import { ExchangeService } from './exchange.service';
import { Exchange } from './entities/exchange.entity';


@Module({
  imports: [TypeOrmModule.forFeature([Pair, Exchange])],
  controllers: [],
  providers: [            
    PairService,
    ExchangeService
  ],
  exports: [    
    PairService, ExchangeService
  ]
})
export class ExchangeModule {}
