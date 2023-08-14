import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AccountService } from './account.service';
import { Account } from './entities/account.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Account])
  ],  
  providers: [AccountService],
  exports: [TypeOrmModule, AccountService]
})
export class UserModule {}
