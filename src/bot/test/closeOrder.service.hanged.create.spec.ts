import { deepEqual, deepStrictEqual, equal } from "assert";
import { BalanceService } from "../../balance/balance.service";
import { FrozenService } from "../../frozen/frozen.service";
import { add, multiply, subtract } from "../../helpers/bc";
import { BuyOrderService } from "../buyOrder.service";
import { CloseOrderService } from "../closeOrder.service";
import { getTestEnv } from "./test.env";

describe('BuyOrderService', () => {
    
    let closeOrderService: CloseOrderService,
        balanceService: BalanceService,
        frozenService: FrozenService,
        api,
        account_id,
        balanceBTC,
        balanceUSDT,
        balanceBNB,
        buyOrder        
        ;

    beforeAll(async () => {
        ({  account_id,
            closeOrderService, 
            balanceService,
            api,
            balanceBTC,
            balanceUSDT,
            balanceBNB,
            frozenService,
            buyOrder
        } = await getTestEnv());
          
    });

    it('create', async () => {                        

        // Prepare

        // dummy Order
        api.setNextOrder({
            price: 42000,
            average:42000,
            amount: buyOrder.amount1,
            filled: 0,
            cost: 0,
            fees: [
              {
                cost: "0",
                currency: 'USDT',
              },
            ]
        });                
        balanceUSDT.amount=10;
        balanceUSDT.available=10;
        balanceBTC.amount=10;
        balanceBTC.in_orders=10;
        balanceBTC.available=0;
        // minAmount 0.0001
        await frozenService.setBalance(account_id, 'BTC', 1, 40000);
        await frozenService.setBalance(account_id, 'USDT', 0, 0);

        // process
        const closeOrder = await closeOrderService.create({
          accountId: account_id,
          id: buyOrder.id,
          needSell: buyOrder.amount1,
          pairId: buyOrder.pairId,
          pairName: buyOrder.pairName,
          prefilled: buyOrder.prefilled,
          rate: 42000
        });

        delete buyOrder['createdAtSec'];
        delete buyOrder['closedAt'];
        delete buyOrder['anualProfitPc'];
        deepEqual(buyOrder, {
          side: 'buy',
          pairId: 1,
          pairName: 'BTC/USDT',
          currency1: 'BTC',
          currency2: 'USDT',
          extOrderId: '1',
          expectedRate: 40000.1,
          rate: 40000,
          amount1: 0.000125,
          amount2: 5,
          amount2_in_usd: 5,
          fee_in_usd: 0.005,
          fee: 0.005,
          fee1: 1.25e-7,
          fee2: 0,
          accountId: 1,          
          id: 1,
          isActive: true,
          prefilled: '0.000125',
          filled: 0,
          profit: 0,                   
        });

        delete closeOrder['createdAtSec'];
        deepEqual(closeOrder, {
          pairName: 'BTC/USDT',
          currency1: 'BTC',
          currency2: 'USDT',
          pairId: 1,
          extOrderId: 0,
          expectedRate: 42000,
          rate: 42000,
          amount1: 0.000125,
          amount2: 5.25,
          amount2_in_usd: 5.25,
          parentId: 1,
          side: 'sell',
          accountId: 1,          
          id: 2,
          isActive: true,
          prefilled: 0,
          filled: 0,
          profit: 0         
        });

        deepEqual(balanceUSDT, {
          for_fee: 0,
          in_orders: 0,
          account_id: 1,
          currency: 'USDT',
          amount: '10',
          available: '10',
          id: 2
        });

        deepEqual(balanceBTC, {
          for_fee: 0,
          in_orders: '9.999875',
          account_id: 1,
          currency: 'BTC',
          amount: '9.999875',
          available: '0.000000',
          id: 1
        });
      
        const frozenBTC = await frozenService.getBalance(account_id, 'BTC');               
        const frozenUSDT = await frozenService.getBalance(account_id, 'USDT');       

        deepEqual(frozenBTC, {
          account_id: 1,
          currency: 'BTC',
          amount: 1,
          amount_in_usd: 40000,
          id: 1,
          avg_rate: 40000
        });
        equal(frozenUSDT.amount, 0);
        
        
      
    });



});

