import { Test, TestingModule } from '@nestjs/testing';
import { BotService } from './bot.service';
import { LogService } from '../log/log.service';
import { equal, notEqual } from 'assert';
import { OrderService } from '../order/order.service';
import { BalanceService } from '../balance/balance.service';
import { ConfigModule } from '@nestjs/config';
import { TestOrderService } from '../order/mock/testorder.service';
import { TestBalanceService } from '../balance/mock/testbalance.service';
import { MockedApiService } from '../exchange/mock/mockedapi.service';
import { MockedExchange } from '../exchange/mock/mocked.exchange';
import { Order } from '../order/entities/order.entity';
import { SilentLogService } from '../log/silentlog.service';
import { ApiService } from '../exchange/api.service';

const { divide, subtract, multiply, compareTo, add } = require("js-big-decimal");



describe('BotService', () => {
  let bot: BotService;
  let exchange:MockedExchange;
  
  

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [        
        ConfigModule.forRoot({
          envFilePath: '.test.env',
        }),    
      ],
      providers: [        
        BotService,
        LogService, 
        MockedApiService,
        MockedExchange,
        {
          provide: LogService,
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
        {
          provide: ApiService,
          useClass: MockedApiService
        },        
      ],
    }).compile();

    bot = await module.resolve<BotService>(BotService);
    bot.setConfig({          
      pair: process.env.BOT_CURRENCY1 +'/'+ process.env.BOT_CURRENCY2,
      orderAmount: Number( process.env.BOT_ORDER_AMOUNT ),
      currency1: process.env.BOT_CURRENCY1,
      currency2: process.env.BOT_CURRENCY2,
      orderProbability: Number( process.env.BOT_ORDER_PROBABILITY ),
      minDailyProfit: Number(process.env.BOT_MIN_DAILY_PROFIT), // % годовых если сделка закрывается за день
      minYearlyProfit: Number(process.env.BOT_MIN_YERLY_PROFIT), // % годовых если сделка живет больше дня
      minBuyRateMarginToProcess: Number(process.env.BOT_MIN_BUY_RATE_MARGIN), // минимальное движение курса для проверки х100=%
      minSellRateMarginToProcess: Number(process.env.BOT_MIN_SELL_RATE_MARGIN), // минимальное движение курса для проверки х100=%
      sellFee:  Number(process.env.BOT_SELL_FEE),
      balanceSync: process.env.BOT_BALANCE_SYNC == 'true'
    });


    const exchangeService = module.get<MockedApiService>(MockedApiService);
    exchange = exchangeService.getExchange();
  });


  const simpleBuyAndSell = async function (buyPrice, amount, sellPrice) {
    const buyCost = buyPrice * amount;
    const sellCost = sellPrice * amount;

    exchange.setTickers({
      'BNB/USDT': {
        last: 20
      }
    });

    await bot.syncData(); 

    // Подготавливаем данные для покупки    
    exchange.setNextOrder({      
      price: buyPrice,
      amount: amount,
      cost: buyCost,
      fee: {
          cost: 0
      }
    });

    // Покупаем        
    const {order} = await bot.createBuyOrder(buyPrice, amount);      
        
    exchange.setNextOrder({      
      price: sellPrice,
      amount: amount,
      cost: sellCost,
      fee: {
          cost: 0
      }
    });    
    // Создаем заявку на продажу
    const closeOrder = await bot.createCloseOrder(sellPrice, order);      
      
    return {order, closeOrder};    
  };


  it('should be defined', () => {
    expect(bot).toBeDefined();
  });


  it('1. simple buy / partial close order', async () => {

    const buyPrice = 1000;
    const amount = 0.001;
    const sellPrice = 1100;
    const sellCost = sellPrice * amount;
    let balanceUSDT=1000;
    const expectedProfit=(sellPrice - buyPrice) * amount;

    const {order, closeOrder} = await simpleBuyAndSell(buyPrice, amount, sellPrice);

    // Зафиксируем баланс
    await bot.balance.set({
      'USDT': balanceUSDT
    });

    // Теперь проверим что будет если заявка закроется не полностью а наполовину
    {
      exchange.setNextOrder({      
        price: sellPrice,
        amount: amount,
        cost: sellCost,
        fee: {
            cost: 0
        },
        filled: amount/2,
      });

      // Проверяем закрытие заявки
      await bot.checkCloseOrder(closeOrder);

      // Ничего не должно закрыться, она будет висеть пока не придет полная сумма
      equal(closeOrder.filled, 0);
      equal(order.profit, 0);

      // balanceUSDT = add(balanceUSDT, sellCost/2);
      equal(balanceUSDT, await bot.balance.getBalanceAmount('USDT'));
    }

    // Теперь докинем оставшуюся сумму
    exchange.setNextOrder({      
      price: sellPrice,
      amount: amount,
      cost: sellCost,
      fee: {
          cost: 0
      },
      filled: amount,
    });

    // Проверяем закрытие заявки
    await bot.checkCloseOrder(closeOrder);

    equal(closeOrder.filled, amount);
    equal(order.profit, expectedProfit);

    balanceUSDT = add(balanceUSDT, sellCost);
    equal(balanceUSDT, await bot.balance.getBalanceAmount('USDT'));

  });

  it('2. simple buy / close order', async () => {

    // Параметры теста
    const buyPrice = 1000;
    const amount = 0.001;
    const buyCost = buyPrice * amount;
    const sellPrice = 1100;
    const sellCost = sellPrice * amount;
    const buyFeeCost=0.01;
    const sellFeeCost=0.001;
    const BNBUSDTRate=20;
    const expectedProfit=((sellPrice - buyPrice) * amount) - buyFeeCost - (sellFeeCost * BNBUSDTRate);

    exchange.setTickers({
      'BNB/USDT': {
        last: BNBUSDTRate
      }
    });

    await bot.syncData(); 

    let balanceBTC:number = await bot.balance.getBalanceAmount('BTC');
    let balanceUSDT:number = await bot.balance.getBalanceAmount('USDT');
    let balanceBNB:number = await bot.balance.getBalanceAmount('BNB');

    // Подготавливаем данные для покупки    
    exchange.setNextOrder({      
      price: buyPrice,
      amount: amount,
      cost: buyCost,
      fee: {
          cost:buyFeeCost,
          currency:'USDT',
      }
    });


    // Покупаем
    let extOrder,order:Order;
    {
        
      const result = await bot.createBuyOrder(buyPrice, amount);
      notEqual(result, false);
      if (result != false) {
        ({extOrder, order} = result);
        expect(extOrder.id).toBeDefined();
        expect(order.id).toBeDefined();

        balanceBTC = add(balanceBTC, amount);
        balanceUSDT = subtract( subtract(balanceUSDT, buyCost), buyFeeCost);
        equal(balanceBTC, await bot.balance.getBalanceAmount('BTC'));
        equal(balanceUSDT, await bot.balance.getBalanceAmount('USDT'));
        
        // console.log(extOrder, order);
      }
    }


    // Создаем заявку на продажу
    let closeOrder:Order;
    exchange.setNextOrder({      
      price: sellPrice,
      amount: amount,
      cost: sellCost,
      fee: {
          cost: sellFeeCost,
          currency:'BNB',
      }
    });

    {
      closeOrder = await bot.createCloseOrder(sellPrice, order);
      equal(order.prefilled, amount);
      equal(closeOrder.parentId, 1);      

      balanceBTC = subtract(balanceBTC, amount);      
      equal(balanceBTC, await bot.balance.getBalanceAmount('BTC'));
      
    }

    
    exchange.setNextOrder({      
      price: sellPrice,
      amount: amount,
      cost: sellCost,
      fee: {
          cost: sellFeeCost,
          currency:'BNB',
      },
      filled: amount,
    });

    // Проверяем закрытие заявки
    await bot.checkCloseOrder(closeOrder);
    equal(closeOrder.filled, amount);
    equal(order.profit, expectedProfit);

    balanceUSDT = add(balanceUSDT, sellCost);
    equal(balanceUSDT, await bot.balance.getBalanceAmount('USDT'));

    balanceBNB = subtract(balanceBNB, sellFeeCost);
    equal(balanceBNB, await bot.balance.getBalanceAmount('BNB'));

  });
});
