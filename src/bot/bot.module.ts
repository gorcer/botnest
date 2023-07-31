import { Module } from '@nestjs/common';
import { BotService } from './bot.service';
import { OrderModule } from '../order/order.module';
import { BalanceService } from '../balance/balance.service';
import { TestApiService } from '../exchange/testapi.service';
import { ApiService } from '../exchange/api.service';
import { BalanceModule } from '../balance/balance.module';
import { LogService } from '../log.service';


const apiService = process.env.BOT_TEST != 'false'
? TestApiService
: ApiService;



@Module({
  imports: [
    OrderModule,
    BalanceModule,
  ],
  controllers: [],
  providers: [
    LogService,
    BotService, 
    BalanceService,    
    {
      provide: 'API',
      useClass: apiService        
    }
  ],
  exports: [BotService],
})
export class BotModule {}
