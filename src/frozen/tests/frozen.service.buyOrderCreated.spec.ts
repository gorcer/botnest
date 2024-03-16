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

    it('event.buyOrderCreated', async () => {                

        await frozenService.setBalance(account_id, 'BTC', 0, 0);
        const balance = await frozenService.buyOrderCreated({
            feeCurrency: 'BTC',
            feeCost: '0.1',
            orderInfo: {
                currency1: 'BTC',
                amount1: 1,
                account_id,
                currency2: 'USDT',
                amount2: 40000
            }
        });
        deepEqual(balance, {
            account_id: 1,
            currency: 'BTC',
            amount: 1,
            amount_in_usd: 40000,
            avg_rate: 40000,
            id: 1
          });   

    });

    

});

