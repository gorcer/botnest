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

    it('checkAndImproveFeeBalance', async () => {                        

        // Prepare

        // dummy Order
        api.setNextOrder({
            price: 40000,
            amount: "0.0001",
            filled: "0.0001",
            cost: 4,
            fees: [
              {
                cost: "0.0000001",
                currency: 'BTC',
              },
            ]
        });                
        balanceUSDT.amount=10;
        balanceUSDT.available=10;
        // minAmount 0.0001

        // process
        await buyOrderService.checkAndImproveFeeBalance(account_id, 1, 0.00025);

        // validate
        deepEqual(balanceBTC, {
            for_fee: '0.0000999',
            in_orders: 0,
            account_id: 1,
            currency: 'BTC',
            amount: '0.0000999',
            available: '0.0000000',
            id: 1
          });

          deepEqual(balanceUSDT,{
            for_fee: 0,
            in_orders: 0,
            account_id: 1,
            currency: 'USDT',
            amount: '6',
            available: '6',
            id: 2
          });          
    });



});

