import { deepEqual } from "assert";
import { multiply } from "../../helpers/bc";
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

    it('event.buyOrderClosed', async () => {                

        await frozenService.setBalance(account_id, 'BTC', 1, 40000);
        const balance = await frozenService.buyOrderClosed({
            feeCurrency: 'USDT',
            feeCost: '4',
            orderInfo: {
                account_id,
                currency1: 'BTC',
                amount1: 0.5,      
                amount2: 10000          
            }
        });
        deepEqual(balance, {
            account_id: 1,
            currency: 'BTC',
            amount: '0.5',
            amount_in_usd: 30000,
            avg_rate: 60000,
            id: 1
          });   

    });

    

});

