import { NestFactory } from '@nestjs/core';
import { DaemonService } from './daemon.service';
import { BotnestModule } from './botnest.module';
import { BotNest } from './bot/botnest.service';
import { BuyOrderService } from './bot/buyOrder.service';
import { CloseOrderService } from './bot/closeOrder.service';
import { subtract } from './helpers/bc';

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
    case 'fetchMarkets':
      const accountId = Number(process.argv[3]);
      const pair = process.argv[4];
      const botNest = await app.resolve(BotNest);
      const api = await botNest.getApiForAccount(accountId);
      const allMarkets = await api.fetchMarkets();
      const markets = allMarkets.filter((item) => item.symbol == pair);

      console.log(
        'precision',
        markets[0].precision,
        'limits',
        markets[0].limits,
      );

      break;
    case 'test':
      {
        const botNest = await app.resolve(BotNest);
        const api = await botNest.getApiForAccount(2);

        console.log(
          api.currencyToPrecision('USDT', 0.000602923677),
          api.currencies['USDT'].precision,
        );
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

        const service = await app.resolve(BuyOrderService);
        const result1 = await service.create({
          accountId,
          pairId: 3,
          rate: 50000,
          amount2: 100,
        });
        const result2 = await service.create({
          accountId,
          pairId: 3,
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

        const r3 = service.create({
          accountId,
          pairId: 3,
          rate: 50000,
          amount2: 100,
        });

        // const r4= service.createCloseOrder({
        //   accountId,
        //   pairName: result2.order.pairName,
        //   rate: 20000,
        //   needSell: result2.order.amount1,
        //   pairId: result2.order.pairId,
        //   prefilled: result2.order.prefilled,
        //   id: result2.order.id,
        // });

        await Promise.all([
          ,
          // r2
          r3,
          // ,r4
        ]);
      }
      break;
    case 'createBuyOrder':
      {
        const accountId = Number(process.argv[3]);
        const rate = Number(process.argv[4]);
        const amount2 = Number(process.argv[5]);
        const service = await app.resolve(BuyOrderService);
        const result = await service.create({
          accountId,
          pairId: 3,
          rate,
          amount2,
        });
        console.log(result);
      }
      break;
    case 'createCloseOrder':
      {
        const accountId = Number(process.argv[3]);
        const rate = Number(process.argv[4]);
        const service = await app.resolve(CloseOrderService);
        const result = await service.create({
          accountId,
          pairName: 'BTC/USDT',
          rate,
          needSell: 0.00001421,
          pairId: 3,
          prefilled: 0,
          id: 8857,
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
