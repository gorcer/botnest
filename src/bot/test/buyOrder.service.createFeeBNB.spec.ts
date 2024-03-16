import { deepEqual, deepStrictEqual, equal } from "assert";
import { BalanceService } from "../../balance/balance.service";
import { FrozenService } from "../../frozen/frozen.service";
import { add, multiply, subtract } from "../../helpers/bc";
import { BuyOrderService } from "../buyOrder.service";
import { getTestEnv } from "./test.env";

describe('BuyOrderService', () => {
    
    let buyOrderService: BuyOrderService,
        balanceService: BalanceService,
        frozenService: FrozenService,
        api,
        account_id,
        balanceBTC,
        balanceUSDT,
        balanceBNB        
        ;

    beforeAll(async () => {
        ({  account_id,
            buyOrderService, 
            balanceService,
            api,
            balanceBTC,
            balanceUSDT,
            balanceBNB,
            frozenService
        } = await getTestEnv());
          
    });

    it('create with fee in BNB', async () => {   

        api.setNextOrder({
            price: 40000,
            amount: "0.000125",
            filled: "0.000125",
            cost: 5,
            fees: [
              {
                cost: "0.0005",
                currency: 'BNB',
              },
            ]
        });  

        await frozenService.setBalance(account_id, 'BTC', 0, 0);
        await frozenService.setBalance(account_id, 'BNB', 0, 0);
        balanceBTC.amount=10;
        balanceBTC.for_fee = 10;        
        balanceBTC.in_orders=0;
        balanceUSDT.amount=10;
        balanceUSDT.available=10;

        const result = await buyOrderService.create({
            accountId: account_id,
            amount2: 5,
            pairId: 1,
            rate: 39000
        });

        // validate order
        delete result.order['createdAtSec'];
        delete result.order['id'];
        deepEqual(result.order, {
            side: 'buy',
            pairId: 1,
            pairName: 'BTC/USDT',
            currency1: 'BTC',
            currency2: 'USDT',
            extOrderId: 0,
            expectedRate: 39000,
            rate: 40000,
            amount1: '0.000125',
            amount2: 5,
            amount2_in_usd: 5,
            fee_in_usd: '0.5',
            fee: '0.5',
            fee1: 0,
            fee2: 0,
            accountId: 1,            
            isActive: true,
            prefilled: 0,
            filled: 0,
            profit: 0
          });

        const frozenBTC = await frozenService.getBalance(account_id, 'BTC');               
        const frozenBNB = await frozenService.getBalance(account_id, 'BNB');               

        deepEqual(frozenBTC, {
            account_id: 1,
            currency: 'BTC',
            amount: result.order.amount1, //'0.000124875',
            amount_in_usd: '5',
            id: 1,
            avg_rate: '40000.00000000'
          });
        equal(frozenBNB.amount, 0);

          deepEqual(balanceBTC, {
            id: 1,
            for_fee: 10,
            in_orders: result.order.amount1,
            account_id: 1,
            currency: 'BTC',
            amount: add(balanceBTC.for_fee, balanceBTC.in_orders),
            available: 0
          });

          deepEqual(balanceUSDT, {
            for_fee: 0,
            in_orders: 0,
            account_id: 1,
            currency: 'USDT',
            amount: '5',
            available: '5',
            id: 2
          });
    });

});

