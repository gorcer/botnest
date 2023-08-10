import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Balance } from './entities/balance.entity';
import { BalanceService } from './balance.service';
import { FileLogService } from '../log/filelog.service';
import { BalanceLog } from './entities/balanceLog.entity';


@Module({
  imports: [TypeOrmModule.forFeature([BalanceLog, Balance])],  
  providers: [BalanceService,FileLogService],
  exports: [BalanceService, TypeOrmModule]
})
export class BalanceModule {}
