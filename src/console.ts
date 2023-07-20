import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { TestApiService } from './binance/testapi.service';
import { BotService } from './bot/bot.service';
import { OrderService } from './order/order.service';


async function bootstrap() {
    const app = await NestFactory.create(AppModule);

  const command = process.argv[2];

  switch (command) {
    case 'trade':
        const testApi = app.get(TestApiService);
        const bot = app.get(BotService);
        await bot.trade(testApi);
        
        break;
    case 'create-order':
      const orderService = app.get(OrderService);
      const order = await orderService.create({
        amount1: 1,
        amount2: 2,
        extOrderId: 1001,
        rate:0.0001
      });
      console.log('Order', order);
      break;
    default:
      console.log('Command not found');
      process.exit(1);
  }

  await app.close();
  process.exit(0);
}

bootstrap();
