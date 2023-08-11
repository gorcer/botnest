import { Test, TestingModule } from '@nestjs/testing';
import { Repository } from 'typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';
import { LonelyTraderService } from './lonelyTrader.service';
import { BotService } from './bot.service';
import { MockedExchange } from '../exchange/mock/mocked.exchange';
import { AccountService } from '../user/account.service';
import { PublicApiService } from '../exchange/publicApi.service';
import { ApiService } from '../exchange/api.service';
import { FileLogService } from '../log/filelog.service';
import { SilentLogService } from '../log/silentlog.service';
import { BalanceService } from '../balance/balance.service';
import { TestBalanceService } from '../balance/mock/testbalance.service';
import { OrderService } from '../order/order.service';
import { TestOrderService } from '../order/mock/testorder.service';
import { equal } from 'assert';
import { ConfigModule } from '@nestjs/config';

describe('LonelyTraderService', () => {
  let trader: LonelyTraderService;
  let orders: OrderService;
  let testOrderRepository = {
    create: (data) => {
      console.log('CREATE', data);
    }
  }

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
        LonelyTraderService,
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

    trader = module.get<LonelyTraderService>(LonelyTraderService);
    orders = module.get<OrderService>(OrderService);
  });

  it('should be defined', () => {
    expect(trader).toBeDefined();
  });

  it('should rate to be occupied', async () => {
    // orders.create({
    //   accountId: 1,
    //   amount1: 0.1,
    //   amount2: 1,
    //   rate: 10,
    //   extOrderId: String(1),
    //   expectedRate: 1,
    //   currency1: "BTC",
    //   currency2: "BUSD"
    // });

    // orders.create({
    //   accountId: 1,
    //   amount1: 0.1,
    //   amount2: 1,
    //   rate: 5,
    //   extOrderId: String(1),
    //   expectedRate: 1,
    //   currency1: "BTC",
    //   currency2: "BUSD"
    // });


    // const activeOrders = await trader.loadActiveOrders();

    // {
    //   const isRateOccupied = trader.isRateOccupied(10, activeOrders, 0.1);
    //   equal(isRateOccupied, true);
    // }

    // {
    //   const isRateOccupied = trader.isRateOccupied(7, activeOrders, 0.1);
    //   equal(isRateOccupied, false);
    // }

    // {
    //   const isRateOccupied = trader.isRateOccupied(5.3, activeOrders, 0.1);
    //   equal(isRateOccupied, true);
    // }
  });
});
