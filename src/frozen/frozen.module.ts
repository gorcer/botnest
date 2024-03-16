import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CacheModule } from '@nestjs/cache-manager';
import { FileLogService } from '../log/filelog.service';
import { FrozenService } from './frozen.service';
import { Frozen } from './frozen.entity';
import { ExchangeModule } from '../exchange/exchange.module';
import { UserModule } from '../user/user.module';

@Module({
  imports: [
    CacheModule.register(), 
    TypeOrmModule.forFeature([Frozen]),
    ExchangeModule,
    UserModule
  ],
  controllers: [],
  providers: [FrozenService, FileLogService],
  exports: [FrozenService, TypeOrmModule],
})
export class FrozenModule {}
