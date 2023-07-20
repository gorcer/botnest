import { Module } from '@nestjs/common';
import { BotService } from './bot.service';
import { OrderModule } from '../order/order.module';

@Module({
  imports: [
    OrderModule    
  ],
  controllers: [],
  providers: [BotService],
  exports: [BotService],
})
export class BotModule {}
