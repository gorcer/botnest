import { Test, TestingModule } from '@nestjs/testing';
import { OrderService } from '../../order/order.service';
import { ConfigModule } from '@nestjs/config';
import { FillCellsStrategy } from './fillCellsStrategy.strategy';
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
import { extractCurrency } from '../../helpers/helpers';
import { FillCells } from './fillCells.entity';
import { StrategyService } from '../strategy.service';
import { Entities } from '../../all.entities';
import { StrategyModule } from '../strategy.module';

describe('AccountsReadyToBuy', () => {

  let service: FillCellsStrategy;
  let orderService: OrderService;
  let pairService: PairService;
  let balanceService: BalanceService;
  let strategyService: StrategyService;

  let orderRepository: Repository<Order>;
  let pairRepository: Repository<Pair>;
  let balanceRepository: Repository<Balance>;


  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          envFilePath: '.test.env',
        }),
        TypeORMMySqlTestingModule(Entities),
        TypeOrmModule.forFeature(Entities),
        OrderModule,
        ExchangeModule,
        BalanceModule,
        StrategyModule
      ],
      providers: [        
      ],
    }).compile();

    
    orderService = module.get<OrderService>(OrderService);
    pairService = module.get<PairService>(PairService);
    balanceService = module.get<BalanceService>(BalanceService);
    strategyService = module.get<StrategyService>(StrategyService);

    orderRepository = module.get<Repository<Order>>(getRepositoryToken(Order));
    pairRepository = module.get<Repository<Pair>>(getRepositoryToken(Pair));
    balanceRepository = module.get<Repository<Balance>>(getRepositoryToken(Balance));

    service = strategyService.getStrategy(FillCellsStrategy);
  });



  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('cell size', async () => {
    const cellSize = FillCellsStrategy.calculateCellSize({
      orderAmount: 0.0001,
      balance: {
        amount: 1000
      },
      pair: {
        id: 1,
        historicalMinRate: 10000,
        sellRate: 20000,
        minAmount1: 0.001
      },
      risk:0
    });


    equal(cellSize, Math.floor(10000 / ((1000) / (20000*0.001)) ));
  });

  it('get orders', async () => {

    const pairName = 'BTC/USDT';
    const { currency1, currency2 } = extractCurrency(pairName);
    const accountId = 1;
    const balanceUSDT = 1000;
    const sellRate = 31000;
    const minAmount1 = 0.01;

    await prepareDB();
    
    const pair = await pairService.fetchOrCreate(pairName);
    await pairService.setInfo(pair, {
      lastPrice: 30000,
      buyRate: 29000,
      sellRate: sellRate,
      minAmount1,
      minAmount2: 10,
      historicalMinRate: 13000
    });

    strategyService.setStrategyForAccount(
      {accountId, pairId: pair.id}, 
      FillCellsStrategy, 
      {
      balance: {
        amount: 900,
        inOrders: 100
      },
      pair,
      orderAmount: 0.0001
    });    
    
    await balanceService.set(
      accountId,
      {
        'USDT': 5
      });


      // Без баланса ничего не выйдет
      {
        const accounts = await service.get(60*60);
        equal(accounts.length, 0);
      }


    await balanceService.set(
      accountId,
      {
        'USDT': balanceUSDT
      });
      // Баланс есть, оредров нет
    {
      const accounts = await service.get(60*60);
      equal(accounts.length, 1);
      equal(accounts[0].rate, sellRate);
      equal(accounts[0].amount1, minAmount1);
    }

    await orderService.create({
      pairName,
      pairId: pair.id,
      accountId,
      amount1: 0.01,
      amount2: 10,
      currency1,
      currency2,
      expectedRate: sellRate,
      rate: 25000,
      extOrderId: "1",
      createdAtSec: Math.floor(Date.now() / 1000)
    });
    // Есть ордер, но в другой рэйт
    {
      const accounts = await service.get(60*60);
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
      extOrderId: "1",
      pairName,
      pairId: pair.id,
      createdAtSec: Math.floor(Date.now() / 1000)
    });
    // Есть ордер и в наш рейт
    {
      const accounts = await service.get();
      equal(accounts.length, 0);
    }

  });

  const prepareDB = async function () {

    if (process.env.TEST_MODE != 'true') {
      throw new Error('Cant run in prod, you loss all data!!!');
    }

    {
      // Truncate orders
      await orderRepository
        .createQueryBuilder()
        .delete()        
        .execute();
    }

    {
      // Truncate pairs
      await pairRepository
        .createQueryBuilder()
        .delete()        
        .execute();
    }

    {
      // Truncate pairs
      await balanceRepository
        .createQueryBuilder()
        .delete()        
        .execute();
    }

  }

});
