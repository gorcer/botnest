import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ApiService } from './api.service';

@Module({
  imports: [TypeOrmModule.forFeature([])],
  controllers: [],
  providers: [ApiService],
  exports: [ApiService]
})
export class ExchangeModule {}
