import { CacheModule } from "@nestjs/cache-manager";
import { ConfigModule } from "@nestjs/config";
import { EventEmitterModule } from "@nestjs/event-emitter";
import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { deepEqual, equal } from "assert";
import { BalanceService } from "../../balance/balance.service";
import { TestBalanceService } from "../../balance/mock/testbalance.service";
import { ApiService } from "../../exchange/api.service";
import { DummyExchange } from "../../exchange/mock/dummy.exchange";
import { multiply, subtract } from "../../helpers/bc";
import { FileLogService } from "../../log/filelog.service";
import { SilentLogService } from "../../log/silentlog.service";
import { TestOrderService } from "../../order/mock/testorder.service";
import { OrderService } from "../../order/order.service";
import { StrategyService } from "../../strategy/strategy.service";
import { getDefaultTestEnv } from "../../test-utils/defaultTestEnv";
import { DefaultTestRepository } from "../../test-utils/DefaultTestRepository";
import { TestingModuleCreate } from "../../test-utils/TestingModuleCreate";
import { AccountService } from "../../user/account.service";
import { Account } from "../../user/entities/account.entity";
import { Frozen } from "../frozen.entity";
import { FrozenService } from "../frozen.service";
import { getTestEnv } from "./test.env";

describe('FrozenService', () => {
    
    let frozenService: FrozenService,
        api,
        account_id=1;

    beforeAll(async () => {
        ({ frozenService, api } = await getTestEnv());
        api.setLastPrice('BTC/USDT', 40000);
    });

    it('getBalance', async () => {            
            const balance = await frozenService.getBalance(account_id, 'BTC');
            equal(balance.account_id, 1);
    });

    it('income', async () => {                
    
            const balance = await frozenService.income(api, account_id, 'BTC', 0.1, 'USDT', 4000);
            deepEqual(balance, {
                account_id: 1,
                currency: 'BTC',
                amount: '0.1',
                amount_in_usd: '4000',
                avg_rate: '40000.00000000',
                id: 1
              });           

    });

    it('outcome', async () => {                

            const balance = await frozenService.outcome(account_id, 'BTC', 0.05);
            deepEqual(balance, {
                account_id: 1,
                currency: 'BTC',
                amount: '0.05',
                amount_in_usd: '2000',
                avg_rate: '40000.00000000',
                id: 1
              });           

    });
   
    it('outcome2', async () => {                

        frozenService.setBalance(account_id, 'BTC', 0.000731573, 33.431782839);
        const balance = await frozenService.outcome(account_id, 'BTC', 0.00000001411, 0.599888061);
        equal(balance.amount_in_usd, subtract(33.431782839, 0.599888061));
        

});

});

