import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Balance } from './entities/balance.entity';
import { BalanceService } from './balance.service';
import { FileLogService } from '../log/filelog.service';


@Module({
  imports: [TypeOrmModule.forFeature([Balance])],  
  providers: [BalanceService,FileLogService],
  exports: [BalanceService, TypeOrmModule]
})
export class BalanceModule {}
