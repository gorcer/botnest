import { Test, TestingModule } from '@nestjs/testing';
import { BotService } from './bot.service';
import { LogService } from '../log/log.service';
import { equal, notEqual } from 'assert';
import { OrderService } from '../order/order.service';
import { BalanceService } from '../balance/balance.service';
import { ConfigModule } from '@nestjs/config';
import { TestOrderService } from '../order/mock/testorder.service';
import { TestBalanceService } from '../balance/mock/testbalance.service';
import { MockedExchange } from '../exchange/mock/mocked.exchange';
import { Order } from '../order/entities/order.entity';
import { SilentLogService } from '../log/silentlog.service';
import { FileLogService } from '../log/filelog.service';
import { ApiService } from '../exchange/api.service';
import ccxt from 'ccxt';
import { AccountService } from '../exchange/account.service';
import { PublicApiService } from '../exchange/publicApi.service';

const { divide, subtract, multiply, compareTo, add } = require("js-big-decimal");



describe('BotService', () => {
  let account: AccountService;
  let bot: BotService;
  let balance: BalanceService;
  let userExchange;
  let publicExchange;
  let api;
  const accountId = 1;
  let currency1, currency2;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          envFilePath: '.test.env',
        }),
      ],
      providers: [
        BotService,
        MockedExchange,
        AccountService,
        {
          provide: PublicApiService,
          useValue: new ApiService(MockedExchange),
        },
        {
          provide: FileLogService,
          useClass: SilentLogService,
        },
        {
          provide: BalanceService,
          useClass: TestBalanceService,
        },
        {
          provide: OrderService,
          useClass: TestOrderService,
        },
      ],
    }).compile();

    bot = await module.resolve<BotService>(BotService);
    account = module.get<AccountService>(AccountService);
    balance = module.get<BalanceService>(BalanceService);

    currency1 = process.env.BOT_CURRENCY1;
    currency2 = process.env.BOT_CURRENCY2;

    bot.setConfig({

      minDailyProfit: Number(process.env.BOT_MIN_DAILY_PROFIT), // % годовых если сделка закрывается за день
      minYearlyProfit: Number(process.env.BOT_MIN_YERLY_PROFIT), // % годовых если сделка живет больше дня			
      sellFee: Number(process.env.BOT_SELL_FEE),
      balanceSync: true

    });

    account.setAccount(1, {

      exchangeClass: MockedExchange,
      pair: process.env.BOT_CURRENCY1 + '/' + process.env.BOT_CURRENCY2,
      orderAmount: Number(process.env.BOT_ORDER_AMOUNT),
      currency1: process.env.BOT_CURRENCY1,
      currency2: process.env.BOT_CURRENCY2,
      orderProbability: Number(process.env.BOT_ORDER_PROBABILITY),
      minDailyProfit: Number(process.env.BOT_MIN_DAILY_PROFIT), // % годовых если сделка закрывается за день
      minYearlyProfit: Number(process.env.BOT_MIN_YERLY_PROFIT), // % годовых если сделка живет больше дня
      minBuyRateMarginToProcess: Number(process.env.BOT_MIN_BUY_RATE_MARGIN), // минимальное движение курса для проверки х100=%
      minSellRateMarginToProcess: Number(process.env.BOT_MIN_SELL_RATE_MARGIN), // минимальное движение курса для проверки х100=%
      sellFee: Number(process.env.BOT_SELL_FEE),
      balanceSync: process.env.BOT_BALANCE_SYNC == 'true'
    });
    api = account.getApiForAccount(accountId);
    userExchange = api.exchange;
    publicExchange = bot.publicApi.exchange;

  });


  it('should be defined', () => {
    expect(bot).toBeDefined();
  });


  it('1. simple buy / partial close order', async () => {

    const buyPrice = 1000;
    const amount = 0.001;
    const sellPrice = 1100;
    const sellCost = sellPrice * amount;
    let balanceUSDT = 1000;
    const expectedProfit = (sellPrice - buyPrice) * amount;

    const { order, closeOrder } = await simpleBuyAndSell(buyPrice, amount, sellPrice);

    // Зафиксируем баланс
    await bot.balance.set(
      accountId,
      {
        'USDT': balanceUSDT
      });

    // Теперь проверим что будет если заявка закроется не полностью а наполовину
    {
      userExchange.setNextOrder({
        price: sellPrice,
        amount: amount,
        cost: sellCost,
        fees: [{
          cost: 0
        }],
        filled: amount / 2,
      });

      // Проверяем закрытие заявки
      await bot.checkCloseOrder(closeOrder);

      // Ничего не должно закрыться, она будет висеть пока не придет полная сумма
      equal(closeOrder.filled, 0);
      equal(order.profit, 0);

      // balanceUSDT = add(balanceUSDT, sellCost/2);
      equal(balanceUSDT, await bot.balance.getBalanceAmount(accountId, 'USDT'));
    }

    // Теперь докинем оставшуюся сумму
    userExchange.setNextOrder({
      price: sellPrice,
      amount: amount,
      cost: sellCost,
      fees: [{
        cost: 0
      }],
      filled: amount,
    });

    // Проверяем закрытие заявки
    await bot.checkCloseOrder(closeOrder);

    equal(closeOrder.filled, amount);
    equal(order.profit, expectedProfit);

    balanceUSDT = add(balanceUSDT, sellCost);
    equal(balanceUSDT, await bot.balance.getBalanceAmount(accountId, 'USDT'));

  });

  it('2. simple buy / close order', async () => {


    // Параметры теста
    const buyPrice = 1000;
    const amount = 0.001;
    const buyCost = buyPrice * amount;
    const sellPrice = 1100;
    const sellCost = sellPrice * amount;
    const buyFeeCost = 0.01;
    const sellFeeCost = 0.001;
    const BNBUSDTRate = 20;
    const expectedProfit = ((sellPrice - buyPrice) * amount) - buyFeeCost - (sellFeeCost * BNBUSDTRate);

    publicExchange.setTickers({
      'BNB/USDT': {
        last: BNBUSDTRate
      }
    });

    await balance.set(accountId, await api.fetchBalances());
    await bot.syncData(accountId,);


    let balanceBTC: number = await bot.balance.getBalanceAmount(accountId, 'BTC');
    let balanceUSDT: number = await bot.balance.getBalanceAmount(accountId, 'USDT');
    let balanceBNB: number = await bot.balance.getBalanceAmount(accountId, 'BNB');

    // Подготавливаем данные для покупки    
    userExchange.setNextOrder({
      price: buyPrice,
      amount: amount,
      cost: buyCost,
      fees: [{
        cost: buyFeeCost,
        currency: 'USDT',
      }]
    });

    // Покупаем
    let extOrder, order: Order;
    {
      const result = await bot.createBuyOrder(accountId, currency1, currency2, buyPrice, amount);
      notEqual(result, false);
      if (result != false) {
        ({ extOrder, order } = result);
        expect(extOrder.id).toBeDefined();
        expect(order.id).toBeDefined();

        balanceBTC = add(balanceBTC, amount);
        balanceUSDT = subtract(subtract(balanceUSDT, buyCost), buyFeeCost);
        equal(balanceBTC, await bot.balance.getBalanceAmount(accountId, 'BTC'));
        equal(balanceUSDT, await bot.balance.getBalanceAmount(accountId, 'USDT'));

        // console.log(extOrder, order);
      }
    }


    // Создаем заявку на продажу
    let closeOrder: Order;
    userExchange.setNextOrder({
      price: sellPrice,
      amount: amount,
      cost: sellCost,
      fees: [{
        cost: sellFeeCost,
        currency: 'BNB',
      }]
    });

    {
      closeOrder = await bot.createCloseOrder(sellPrice, order);
      equal(order.prefilled, amount);
      equal(closeOrder.parentId, 1);
      equal(closeOrder.accountId, 1);

      balanceBTC = subtract(balanceBTC, amount);
      equal(balanceBTC, await bot.balance.getBalanceAmount(accountId, 'BTC'));

    }


    userExchange.setNextOrder({
      price: sellPrice,
      amount: amount,
      cost: sellCost,
      fees: [{
        cost: sellFeeCost,
        currency: 'BNB',
      }],
      filled: amount,
    });

    // Проверяем закрытие заявки
    await bot.checkCloseOrder(closeOrder);

    equal(closeOrder.filled, amount);
    equal(order.profit, expectedProfit);

    balanceUSDT = add(balanceUSDT, sellCost);
    equal(balanceUSDT, await bot.balance.getBalanceAmount(accountId, 'USDT'));

    balanceBNB = subtract(balanceBNB, sellFeeCost);
    equal(balanceBNB, await bot.balance.getBalanceAmount(accountId, 'BNB'));

  });

  

  const simpleBuyAndSell = async function (buyPrice: number, amount: number, sellPrice: number) {
    const buyCost = buyPrice * amount;
    const sellCost = sellPrice * amount;

    publicExchange.setTickers({
      'BNB/USDT': {
        last: 20
      }
    });

    await balance.set(accountId, await api.fetchBalances());
    await bot.syncData(accountId);

    // Подготавливаем данные для покупки    
    userExchange.setNextOrder({
      price: buyPrice,
      amount: amount,
      cost: buyCost,
      fees: [{
        cost: 0
      }]
    });

    // Покупаем        
    const { order } = await bot.createBuyOrder(accountId, currency1, currency2, buyPrice, amount);

    userExchange.setNextOrder({
      price: sellPrice,
      amount: amount,
      cost: sellCost,
      fees: [{
        cost: 0
      }]
    });
    // Создаем заявку на продажу
    const closeOrder = await bot.createCloseOrder(sellPrice, order);

    return { order, closeOrder };
  };

});
