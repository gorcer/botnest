import { Test, TestingModule } from '@nestjs/testing';
import { OrderService } from '../order/order.service';
import { ConfigModule } from '@nestjs/config';
import { AccountsReadyToBuy } from './accountsReadyToBuy.service';
import { Balance } from '../balance/entities/balance.entity';
import { TypeOrmModule, getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OrderModule } from '../order/order.module';
import { Order } from '../order/entities/order.entity';
import { TypeORMMySqlTestingModule } from '../test-utils/TypeORMMySqlTestingModule';
import { Pair } from '../exchange/entities/pair.entity';
import { ExchangeModule } from '../exchange/exchange.module';
import { PairService } from '../exchange/pair.service';
import { BalanceService } from '../balance/balance.service';
import { BalanceModule } from '../balance/balance.module';
import { equal } from 'assert';

describe('AccountsReadyToBuy', () => {

  let service: AccountsReadyToBuy;
  let orderService: OrderService;
  let pairService: PairService;
  let balanceService: BalanceService;

  let orderRepository: Repository<Order>;
  let pairRepository: Repository<Pair>;


  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          envFilePath: '.test.env',
        }),
        TypeORMMySqlTestingModule([Balance, Order, Pair]),
        TypeOrmModule.forFeature([Balance, Order, Pair]),
        OrderModule,
        ExchangeModule,
        BalanceModule
      ],
      providers: [
        AccountsReadyToBuy,
      ],
    }).compile();

    service = module.get<AccountsReadyToBuy>(AccountsReadyToBuy);
    orderService = module.get<OrderService>(OrderService);
    pairService = module.get<PairService>(PairService);
    balanceService = module.get<BalanceService>(BalanceService);
    orderRepository = module.get<Repository<Order>>(getRepositoryToken(Order));
    pairRepository = module.get<Repository<Pair>>(getRepositoryToken(Pair));

    await prepareDB();
  });



  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('get orders', async () => {

    const currency1 = 'BTC';
    const currency2 = 'USDT';
    const accountId = 1;
    const balanceUSDT = 1000;
    const sellRate = 31000;
    const minAmount1 = 0.01;


    const pair = await pairService.fetchOrCreatePair(currency1, currency2);
    await pairService.setInfo(pair, {
      lastPrice: 30000,
      buyRate: 29000,
      sellRate: sellRate,
      minAmount1,
      minAmount2: 10,
    });

    
    await balanceService.set(
      accountId,
      {
        'USDT': 5
      });


      // Без баланса ничего не выйдет
      {
        const accounts = await service.get(0.00001, 0.0001);
        equal(accounts.length, 0);
      }


    await balanceService.set(
      accountId,
      {
        'USDT': balanceUSDT
      });
      // Баланс есть, оредров нет
    {
      const accounts = await service.get(0.00001, 0.0001);
      equal(accounts.length, 1);
      equal(accounts[0].rate, sellRate);
      equal(accounts[0].amount1, minAmount1);
    }

    await orderService.create({
      accountId,
      amount1: 0.01,
      amount2: 10,
      currency1,
      currency2,
      expectedRate: sellRate,
      rate: 25000,
      extOrderId: "1"
    });
    // Есть ордер, но в другой рэйт
    {
      const accounts = await service.get(0.00001, 0.0001);
      equal(accounts.length, 1);
    }
    
    await orderService.create({
      accountId,
      amount1: 0.01,
      amount2: 10,
      currency1,
      currency2,
      expectedRate: sellRate,
      rate: sellRate,
      extOrderId: "1"
    });
    // Есть ордер и в наш рейт
    {
      const accounts = await service.get(0.00001, 0.0001);
      equal(accounts.length, 0);
    }

  });

  const prepareDB = async function () {

    if (process.env.BOT_TEST != 'true') {
      throw new Error('Cant run in prod, you loss all data!!!');
    }

    {
      // Truncate orders
      await orderRepository
        .createQueryBuilder()
        .delete()
        .from(Order)
        .execute();
    }

    {
      // Truncate pairs
      await pairRepository
        .createQueryBuilder()
        .delete()
        .from(Pair)
        .execute();
    }

  }

});