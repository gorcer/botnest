import { NestFactory } from '@nestjs/core';
import { DaemonService } from './daemon.service';
import { BotnestModule } from './botnest.module';
import { BotNest } from './bot/botnest.service';
import { TradeService } from './bot/trade.service';

async function bootstrap() {
  const app = await NestFactory.create(BotnestModule);

  const command = process.argv[2];

  switch (command) {
    case 'daemon':
      {
        const bot = await app.resolve(DaemonService);
        await bot.init();
        await bot.trade();
      }
      break;
    case 'checkBalance':
      {
        const accountId = Number(process.argv[3]);
        const botNest = await app.resolve(BotNest);
        const result = await botNest.checkBalance(accountId);
        console.log(result);
      }
      break;
    case 'testOrders':
      {
        const accountId = 1;
        
        const service = await app.resolve(TradeService);
        const result1 = await service.createBuyOrder({
          accountId,
          pairName: 'BTC/USDT',
          rate: 50000,
          amount2: 100,
        });
        const result2 = await service.createBuyOrder({
          accountId,
          pairName: 'BTC/USDT',
          rate: 50000,
          amount2: 100,
        });

        // console.log('Finish');
        // await new Promise(r => setTimeout(r, 10000));

        // const botNest = await app.resolve(BotNest);
        // await botNest.checkBalance(accountId);
        
        // const r2= service.createCloseOrder({
        //   accountId,
        //   pairName: result1.order.pairName,
        //   rate: 20000,
        //   needSell: result1.order.amount1,
        //   pairId: result1.order.pairId,
        //   prefilled: result1.order.prefilled,
        //   id: result1.order.id,
        // });
       
        const r3= service.createBuyOrder({
          accountId,
          pairName: 'BTC/USDT',
          rate: 50000,
          amount2: 100,
        });

        const r4= service.createCloseOrder({
          accountId,
          pairName: result2.order.pairName,
          rate: 20000,
          needSell: result2.order.amount1,
          pairId: result2.order.pairId,
          prefilled: result2.order.prefilled,
          id: result2.order.id,
        });

        await Promise.all([
          // r2
          ,r3
          ,r4
        ]);
      

      }
      break;
    case 'createBuyOrder':
      {
        const accountId = Number(process.argv[3]);
        const rate = Number(process.argv[4]);
        const service = await app.resolve(TradeService);
        const result = await service.createBuyOrder({
          accountId,
          pairName: 'BTC/USDT',
          rate,
          amount2: 100,
        });
        console.log(result);
      }
      break;
    case 'createCloseOrder':
      {
        const accountId = Number(process.argv[3]);
        const rate = Number(process.argv[4]);
        const service = await app.resolve(TradeService);
        const result = await service.createCloseOrder({
          accountId,
          pairName: 'BTC/USDT',
          rate,
          needSell: 0.002,
          pairId: 3,
          prefilled: 1,
          id: 18,
        });
        console.log(result);
      }
      break;
    case 'test':
      {
        process.env.TZ = 'Europe/Moscow';
        const date = new Date();

        console.log(date);
      }
      break;
  }
  await app.close();
  process.exit(0);
}

bootstrap();
