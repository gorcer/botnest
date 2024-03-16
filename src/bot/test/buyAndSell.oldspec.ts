import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { equal } from 'assert';
import { pro as ccxt } from 'ccxt';
import { CacheModule } from '@nestjs/cache-manager';
import { ApiService } from '../../exchange/api.service';
import { AccountService } from '../../user/account.service';
import { TradeService } from '../trade.service';
import { ExchangeModule } from '../../exchange/exchange.module';
import { BotModule } from '../bot.module';
import { StrategyModule } from '../../strategy/strategy.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Entities } from '../../all.entities';

describe('ApiService', () => {
  let apiService: ApiService;
  let api;
  let tradeService: TradeService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [
        CacheModule.register(),
        ConfigModule.forRoot({
          envFilePath: '.test.env',
        }),
        TypeOrmModule.forRoot({
          type: 'postgres',
          host: 'localhost',
          port: parseInt(process.env.DB_PORT),
          username: process.env.DB_LOGIN,
          password: process.env.DB_PASS,
          database: process.env.DB_NAME,
          entities: Entities,
          synchronize: false,
          logging: process.env.DB_LOGGING == 'true',
        }),
        ExchangeModule,
        BotModule,
        StrategyModule,
      ],
      providers: [ApiService, AccountService, TradeService],
    }).compile();

    apiService = module.get<ApiService>(ApiService);
    const accountService = module.get<AccountService>(AccountService);
    api = accountService.getApiForAccount(2);
    tradeService = module.get<TradeService>(TradeService);
  });

  it('create buy and sell order', async () => {
    const currency1 = 'BTC';
    const currency2 = 'BUSD';
    const pair = currency1 + '/' + currency2;
    const prevBalances = await apiService.fetchBalances(api);
    const prevBTCBalance = prevBalances[currency1];
    const prevUSDTBalance = prevBalances[currency2];
    const amount1 = 0.001;
    const accountId = 2;
    const buyRate = 50000;

    const order = await tradeService.createBuyOrder({
      accountId,
      pairName: 'BTC/USDT',
      rate: buyRate,
      amount2: 100,
    });

    console.log(order);

    // const balances = await apiService.fetchBalances(api);
    // const BTCBalance = balances[currency1];
    // const USDTBalance = balances[currency2];

    // const expectedBTCBalance = add(prevBTCBalance, amount1);
    // const expectedUSDTBalance = subtract(prevUSDTBalance, amount2);

    // equal(compareTo(BTCBalance, expectedBTCBalance), 0);
    // equal(compareTo(USDTBalance, expectedUSDTBalance), 0);
  });
});
