import { Test, TestingModule } from '@nestjs/testing';
import { OrderService } from '../../order/order.service';
import { ConfigModule } from '@nestjs/config';
import { Balance } from '../../balance/entities/balance.entity';
import { TypeOrmModule, getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OrderModule } from '../../order/order.module';
import { Order } from '../../order/entities/order.entity';
import { TypeORMMySqlTestingModule } from '../../test-utils/TypeORMMySqlTestingModule';
import { Pair } from '../../exchange/entities/pair.entity';
import { ExchangeModule } from '../../exchange/exchange.module';
import { PairService } from '../../exchange/pair.service';
import { BalanceService } from '../../balance/balance.service';
import { BalanceModule } from '../../balance/balance.module';
import { equal } from 'assert';
import { AwaitProfitStrategy } from './awaitProfitStrategy.strategy';
import { extractCurrency } from '../../helpers/helpers';
import { AwaitProfit } from './awaitProfit.entity';
import { StrategyService } from '../strategy.service';
import { StrategyModule } from '../strategy.module';

describe('ActiveOrdersAboveProfit', () => {
  let service: AwaitProfitStrategy;
  let orderService: OrderService;
  let pairService: PairService;
  let balanceService: BalanceService;
  let strategyService: StrategyService;

  let orderRepository: Repository<Order>;
  let pairRepository: Repository<Pair>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          envFilePath: '.test.env',
        }),
        TypeORMMySqlTestingModule([Balance, Order, Pair, AwaitProfit]),
        TypeOrmModule.forFeature([Balance, Order, Pair, AwaitProfit]),
        OrderModule,
        ExchangeModule,
        BalanceModule,
        StrategyModule,
      ],
      providers: [],
    }).compile();

    orderService = module.get<OrderService>(OrderService);
    pairService = module.get<PairService>(PairService);
    balanceService = module.get<BalanceService>(BalanceService);
    strategyService = module.get<StrategyService>(StrategyService);

    orderRepository = module.get<Repository<Order>>(getRepositoryToken(Order));
    pairRepository = module.get<Repository<Pair>>(getRepositoryToken(Pair));

    service = strategyService.getStrategy(AwaitProfitStrategy);

    await prepareDB();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('get orders to sell', async () => {
    const pairName = 'BTC/USDT';
    const { currency1, currency2 } = extractCurrency(pairName);
    const accountId = 1;
    const balanceUSDT = 1000;
    const balanceBUSD = 1000;
    const buyRate = 11000;
    const sellRate = 11000;
    const minAmount1 = 0.01;

    await balanceService.set(accountId, {
      USDT: balanceUSDT,
      BUSD: balanceBUSD,
    });

    strategyService.setStrategyForAccount({ accountId }, AwaitProfitStrategy, {
      minDailyProfit: 200,
      minYerlyProfit: 30,
    });
    const pair = await pairService.fetchOrCreate(pairName);
    await orderService.create({
      pairName,
      pairId: pair.id,
      accountId,
      amount1: 0.01,
      amount2: 10,
      currency1,
      currency2,
      expectedRate: sellRate,
      rate: 10000,
      extOrderId: '1',
      createdAtSec: 0,
    });

    {
      await pairService.setInfo(pair, {
        lastPrice: buyRate,
        buyRate: buyRate,
        sellRate: sellRate,
        minAmount1,
        minAmount2: 10,
        fee: 0.001,
      });

      const orders = await service.get(10);
      equal(orders.length, 1);
    }

    {
      await pairService.setInfo(pair, {
        lastPrice: 10000,
        buyRate: 10000,
        sellRate: 10000,
        minAmount1,
        minAmount2: 10,
        fee: 0.001,
      });

      const orders = await service.get(10);
      equal(orders.length, 0);
    }
  });

  const prepareDB = async function () {
    if (process.env.TEST_MODE != 'true') {
      throw new Error('Cant run in prod, you loss all data!!!');
    }

    {
      // Truncate orders
      await orderRepository.createQueryBuilder().delete().from(Order).execute();
    }

    {
      // Truncate pairs
      await pairRepository.createQueryBuilder().delete().from(Pair).execute();
    }

    {
      // Truncate AwaitProfit
      await pairRepository
        .createQueryBuilder()
        .delete()
        .from(AwaitProfit)
        .execute();
    }
  };
});
