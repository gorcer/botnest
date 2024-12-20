import { NestFactory } from '@nestjs/core';
import { DaemonService } from './daemon.service';
import { BotnestModule } from './botnest.module';
import { BotNest } from './bot/botnest.service';
import { BuyOrderService } from './bot/buyOrder.service';
import { CloseOrderService } from './bot/closeOrder.service';
import { subtract } from './helpers/bc';
import { sleep } from './helpers/helpers';
import { OrderService } from './order/order.service';
import { ApiService } from './exchange/api.service';

process.on('unhandledRejection', (err) => {
  console.error('Unhandled Rejection:', err);
});

async function bootstrap() {
  const app = await NestFactory.create(BotnestModule);

  const command = process.argv[2];

  switch (command) {
    case 'daemon': {
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
    case 'fetchOrder': {

      const extOrderId = String(process.argv[3]);
      console.log('Find by ' + extOrderId);
      const orderService = await app.resolve(OrderService);
      const order = await orderService.findOne({ extOrderId });

      const botNest = await app.resolve(BotNest);
      const api = await botNest.getApiForAccount(order.accountId);

      const apiService = await app.resolve(ApiService);
      const extOrder = await apiService.fetchOrder(
        api,
        extOrderId,
        order.pairName,
      );
      console.log(extOrder);
    }
      break;
    case 'fetchMyTrades': {

      const accountId = Number(process.argv[3]);
      const pair = String(process.argv[4]);
      const botNest = await app.resolve(BotNest);
      const api = await botNest.getApiForAccount(accountId);
      const apiService = await app.resolve(ApiService);

      const trades = await apiService.fetchMyTrades(
        api,
        pair,
        Date.now() - 60 * 60 * 24*1000,
      );
      console.log(trades);
    }
      break;
    case 'checkBalance': {
      const accountId = Number(process.argv[3]);
      const botNest = await app.resolve(BotNest);
      const result = await botNest.checkBalance(accountId);
      console.log(result);
    }
      break;
    case 'test': {
      const accountId = Number(process.argv[3]);
      const botNest = await app.resolve(BotNest);
      const api = await botNest.getApiForAccount(accountId);

      console.log(api.exchange);
    }
      break;
    //   case 'testOrders2':
    //     {
    //       const botNest = await app.resolve(BotNest);
    //       const exchange = await botNest.getApiForAccount(1);

    //       const symbol = 'BTC/USDT';
    //       const side = 'buy';
    //       const type = 'limit';
    //       const price = 50000; // Цена
    //       const amount = 0.001; // Количество


    //       try {
    //         console.log('Try to buy 1');
    //         // exchange.verbose = true;
    //         const order = await exchange.createOrderWs(symbol, type, side, amount, price);
    //         console.log('Ok', order.id);
    //         console.log('Try to buy 2');
    //         sleep(10);
    //         const order2 = await exchange.createOrderWs(symbol, type, side, amount, price);
    //         console.log('Ok', order2.id);

    //       } catch (e) {
    //         console.log('e', e);
    //       }

    //     };

    //     break;
    // },
    case 'testOrders': {
      const accountId = 1;

      const service = await app.resolve(BuyOrderService);
      while (true) {
        try {
          const result1 = await service.create({
            accountId,
            pairId: 3,
            rate: 50000,
            amount2: 100,
          });
        } catch (e) {
          console.log('e', e);
        }

        // try {
        //   const result2 = await service.create({
        //     accountId,
        //     pairId: 3,
        //     rate: 50000,
        //     amount2: 100,
        //   });
        // } catch (e) { }

        await sleep(10);
      }

      await sleep(3000);

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

      const r3 = await service.create({
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

      // await Promise.all([
      //   ,
      //   // r2
      //   r3,
      //   // ,r4
      // ]);
    }
      break;
    case 'createBuyOrder': {
      const accountId = Number(process.argv[3]);
      const rate = Number(process.argv[4]);
      const amount2 = Number(process.argv[5]);
      const service = await app.resolve(BuyOrderService);
      const result = await service.create({
        accountId,
        pairId: 9,
        rate,
        amount2,
      });
      console.log(result);
    }
      break;
    case 'createCloseOrder': {
      const accountId = Number(process.argv[3]);
      const rate = Number(process.argv[4]);
      const service = await app.resolve(CloseOrderService);
      const result = await service.create({
        accountId,
        pairName: 'BTC/USDT',
        rate,
        needSell: 0.00001421,
        pairId: 3,
        preclosed: 0,
        id: 8857,
      });
      console.log(result);
    }
      break;
    case 'test': {
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
