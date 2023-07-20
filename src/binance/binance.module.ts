import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ApiService } from './api.service';
import { TestApiService } from './testapi.service';



@Module({
  imports: [TypeOrmModule.forFeature([])],
  controllers: [],
  providers: [ApiService, TestApiService],
  exports: [ApiService, TestApiService]
})
export class BinanceModule {}
