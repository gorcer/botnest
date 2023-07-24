import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Balance } from './entities/balance.entity';
import { BalanceService } from './balance.service';


@Module({
  imports: [TypeOrmModule.forFeature([Balance])],  
  providers: [BalanceService],
  exports: [BalanceService, TypeOrmModule]
})
export class BalanceModule {}
