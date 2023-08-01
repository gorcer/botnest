import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { equal } from 'assert';
import { ApiService } from './api.service';
const { add, subtract, compareTo } = require('js-big-decimal');

describe('OrderService', () => {
  let service: ApiService;
  

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          envFilePath: '.test.env',
        }),
      ],
      providers: [
        ApiService
      ],
    }).compile();

    service = module.get<ApiService>(ApiService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('create buy order and check balance', async () => {

      const currency1 = 'BTC';
      const currency2 = 'BUSD';
      const prevBalances = await service.fetchBalances();
      const prevBTCBalance = prevBalances[currency1];
      const prevUSDTBalance = prevBalances[currency2];
      const amount1 = 0.00038;

      const order = await service.createOrder(currency1+'/'+currency2,'market', 'buy', amount1);
      const amount2 = order.cost;

      const balances = await service.fetchBalances();
      const BTCBalance = balances[currency1];
      const USDTBalance = balances[currency2];

      const expectedBTCBalance = add(prevBTCBalance, amount1);
      const expectedUSDTBalance = subtract(prevUSDTBalance, amount2);

      equal(compareTo(BTCBalance, expectedBTCBalance), 0);
      equal(compareTo(USDTBalance, expectedUSDTBalance), 0);

  });

  it('create sell order and check balance', async () => {

      const currency1 = 'LTC';
      const currency2 = 'BTC';
      const amount1 = 0.001;

      const prevBalances = await service.fetchBalances();
      const prevBTCBalance = prevBalances[currency1];
        const prevUSDTBalance = prevBalances[currency2];
      

      const order = await service.createOrder(currency1+'/'+currency2,'market', 'sell', amount1);
      const amount2 = order.cost;

      const balances = await service.fetchBalances();
      const BTCBalance = balances[currency1];
      const USDTBalance = balances[currency2];

      const expectedBTCBalance = subtract(prevBTCBalance, amount1);
      const expectedUSDTBalance = add(prevUSDTBalance, amount2);

      equal(compareTo(BTCBalance, expectedBTCBalance), 0);
      equal(compareTo(USDTBalance, expectedUSDTBalance), 0);

  });
});
