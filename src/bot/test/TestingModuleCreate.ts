import { ConfigModule } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { TradeService } from '../trade.service';
import { DummyExchange } from '../../exchange/mock/dummy.exchange';
import { AccountService } from '../../user/account.service';
import { StrategyService } from '../../strategy/strategy.service';
import { PublicApiService } from '../../exchange/publicApi.service';
import { ApiService } from '../../exchange/api.service';
import { FileLogService } from '../../log/filelog.service';
import { SilentLogService } from '../../log/silentlog.service';
import { BalanceService } from '../../balance/balance.service';
import { TestBalanceService } from '../../balance/mock/testbalance.service';
import { OrderService } from '../../order/order.service';
import { TestOrderService } from '../../order/mock/testorder.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Pair } from '../../exchange/entities/pair.entity';
import { DefaultTestRepository } from '../../test-utils/DefaultTestRepository';
import { PairService } from '../../exchange/pair.service';
import { Account } from '../../user/entities/account.entity';
import { TestStrategyService } from '../../strategy/mock/teststrategy.service';
import { ExchangeService } from '../../exchange/exchange.service';

export async function TestingModuleCreate() {
  const accountId = 1;

  const module: TestingModule = await Test.createTestingModule({
    imports: [
      ConfigModule.forRoot({
        envFilePath: '.test.env',
      }),
    ],
    providers: [
      TradeService,
      DummyExchange,
      AccountService,
      {
        provide: getRepositoryToken(Account),
        useClass: DefaultTestRepository,
      },
      {
        provide: StrategyService,
        useClass: TestStrategyService,
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
      {
        provide: getRepositoryToken(Pair),
        useClass: DefaultTestRepository,
      },
      PairService,
    ],
  }).compile();

  const bot = await module.resolve<TradeService>(TradeService);
  const pairs = module.get<PairService>(PairService);
  const balances = module.get<BalanceService>(BalanceService);

  const accounts = module.get<AccountService>(AccountService);
  const userAccount = await accounts.fetchOrCreate(1);
  await accounts.setAccount(userAccount, {
    apiKey: process.env.EXCHANGE_API_KEY,
    secret: process.env.EXCHANGE_API_SECRET,
    exchange: {
      exchange_name: process.env.EXCHANGE_NAME,
      test_mode: process.env.TEST_MODE == 'true',
    },
  });

  const publicApi = new PublicApiService(DummyExchange, true);
  const publicExchange = publicApi.exchange;

  const api = await accounts.getApiForAccount(accountId);
  api.exchange = publicExchange;

  return { module, bot, pairs, publicExchange, balances, api, publicApi };
}
