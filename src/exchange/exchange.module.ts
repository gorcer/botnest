import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PairService } from './pair.service';
import { Pair } from './entities/pair.entity';
import { ExchangeService } from './exchange.service';
import { Exchange } from './entities/exchange.entity';
import { ApiService } from './api.service';
import { CacheModule } from '@nestjs/cache-manager';

@Module({
  imports: [CacheModule.register(), TypeOrmModule.forFeature([Pair, Exchange])],
  controllers: [],
  providers: [PairService, ExchangeService, ApiService],
  exports: [PairService, ExchangeService, ApiService],
})
export class ExchangeModule {}
