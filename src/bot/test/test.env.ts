import { getRepositoryToken } from "@nestjs/typeorm";
import { time } from "console";
import { BalanceService } from "../../balance/balance.service";
import { Balance } from "../../balance/entities/balance.entity";
import { BalanceLog } from "../../balance/entities/balanceLog.entity";
import { TestBalanceService } from "../../balance/mock/testbalance.service";
import { ApiService } from "../../exchange/api.service";
import { Pair } from "../../exchange/entities/pair.entity";
import { ExchangeModule } from "../../exchange/exchange.module";
import { DummyExchange } from "../../exchange/mock/dummy.exchange";
import { PairService } from "../../exchange/pair.service";
import { Frozen } from "../../frozen/frozen.entity";
import { FrozenService } from "../../frozen/frozen.service";
import { updateModel } from "../../helpers/helpers";
import { OrderSideEnum } from "../../order/entities/order.entity";
import { TestOrderService } from "../../order/mock/testorder.service";
import { OrderService } from "../../order/order.service";
import { getDefaultTestEnv } from "../../test-utils/defaultTestEnv";
import { DefaultTestRepository } from "../../test-utils/DefaultTestRepository";
import { AccountService } from "../../user/account.service";
import { BuyOrderService } from "../buyOrder.service";
import { CloseOrderService } from "../closeOrder.service";
import { FeeService } from "../fee.service";
import { TradeCheckService } from "../tradeCheck.service";

export async function getTestEnv() {

    const account_id=1;
    const env = await getDefaultTestEnv({
        modules: [
            // ExchangeModule
        ],
        providers:
        [   
            {
                provide: getRepositoryToken(Pair),
                useClass: DefaultTestRepository,
            },  
            {
                provide: getRepositoryToken(Frozen),
                useClass: DefaultTestRepository,
            }, 
            {
                provide: getRepositoryToken(Balance),
                useClass: DefaultTestRepository,
            },  
            {
                provide: getRepositoryToken(BalanceLog),
                useClass: DefaultTestRepository,
            },                      
            {
                provide: OrderService,
                useClass: TestOrderService,
            },
            DummyExchange,
            AccountService,
            ApiService,
            BuyOrderService,
            CloseOrderService,
            PairService,
            TradeCheckService,
            FeeService,
            BalanceService,
            FrozenService
        ]
    }
    );
    
    const {module, api} = env;
    const frozenService = module.get<FrozenService>(FrozenService);    
    const buyOrderService = module.get<BuyOrderService>(BuyOrderService);    
    const closeOrderService = module.get<CloseOrderService>(CloseOrderService);    
    const orderService = module.get<OrderService>(OrderService);    
    
    const balanceService = module.get<BalanceService>(BalanceService);    
    //@ts-ignore
    balanceService.balanceRepository.setDefault({
        for_fee:0,
        in_orders: 0
    });

    // ------------- set PAIR ---------
    const pairService = module.get<PairService>(PairService);        
    const pair = await pairService.fetchOrCreate(1, 'BTC/USDT');
    pairService.setInfo(pair, {
        lastPrice: 40000,
        minAmount1: 0.0001,
        minAmount2: 4,
        buyRate: 40000,
        sellRate: 40000,
        fee: 0.001
    });

    // ----------- set Balance--------------
    const balanceBTC = await balanceService.getBalance(account_id, 'BTC');
    const balanceUSDT = await balanceService.getBalance(account_id, 'USDT');
    const balanceBNB = await balanceService.getBalance(account_id, 'BNB');
    
    updateModel(balanceUSDT, {
        amount: 10,
        available: 10
    });

    api.setLastPrice('BTC/USDT', 40000);   
    api.setLastPrice('BNB/USDT', 1000);   

    
    // ------- test Order -----
    const buyOrder = await orderService.create({        
        side: OrderSideEnum.BUY,
        pairId: 1,
        pairName: 'BTC/USDT',
        currency1: 'BTC',
        currency2: 'USDT',
        extOrderId: "1",
        expectedRate: 40000.1,
        rate: 40000,
        amount1: 0.000125,
        amount2: 5,
        amount2_in_usd: 5,
        fee_in_usd: 0.005,
        fee: 0.005,
        fee1: 0.000000125,
        fee2: 0,
        accountId: 1,                                                
        createdAtSec: Date.now()
      });


    return { 
        account_id,
        buyOrderService, 
        closeOrderService,
        balanceService, 
        frozenService,
        api, 
        balanceBTC, 
        balanceUSDT,
        balanceBNB,
        buyOrder
    };
};