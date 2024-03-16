import { deepEqual } from 'assert';
import { BalanceService } from '../../balance/balance.service';
import { FrozenService } from '../../frozen/frozen.service';
import { add, subtract } from '../../helpers/bc';
import { BuyOrderService } from '../buyOrder.service';
import { getTestEnv } from './test.env';

describe('BuyOrderService', () => {
  let buyOrderService: BuyOrderService,
    frozenService: FrozenService,
    api,
    account_id,
    balanceBTC,
    balanceUSDT;

  beforeAll(async () => {
    ({
      account_id,
      buyOrderService,
      api,
      balanceBTC,
      balanceUSDT,
      frozenService,
    } = await getTestEnv());
  });

  it('create with fee in BTC', async () => {
    api.setNextOrder({
      price: 40000,
      amount: '0.000125',
      filled: '0.000125',
      cost: 5,
      fees: [
        {
          cost: '1.25e-7',
          currency: 'BTC',
        },
      ],
    });

    await frozenService.setBalance(account_id, 'BTC', 0, 0);
    balanceBTC.amount = 10;
    balanceBTC.for_fee = 10;
    balanceUSDT.amount = 10;
    balanceUSDT.available = 10;
    // minAmount 0.0001

    // process
    const result = await buyOrderService.create({
      accountId: account_id,
      amount2: 5,
      pairId: 1,
      rate: 40000.1,
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
      expectedRate: 40000.1,
      rate: 40000,
      amount1: '0.000125',
      amount2: 5,
      amount2_in_usd: 5,
      fee_in_usd: '0.005',
      fee: '0.005',
      fee1: '1.25e-7',
      fee2: 0,
      accountId: 1,
      isActive: true,
      prefilled: 0,
      filled: 0,
      profit: 0,
    });

    const frozenBTC = await frozenService.getBalance(account_id, 'BTC');

    deepEqual(frozenBTC, {
      account_id: 1,
      currency: 'BTC',
      amount: result.order.amount1, //'0.000124875',
      amount_in_usd: '5',
      id: 1,
      avg_rate: '40000.00000000',
    });

    deepEqual(balanceBTC, {
      id: 1,
      for_fee: subtract(10, result.order.fee1),
      in_orders: result.order.amount1,
      account_id: 1,
      currency: 'BTC',
      amount: add(balanceBTC.for_fee, balanceBTC.in_orders),
      available: '0.000000000',
    });

    deepEqual(balanceUSDT, {
      for_fee: 0,
      in_orders: 0,
      account_id: 1,
      currency: 'USDT',
      amount: '5',
      available: '5',
      id: 2,
    });
  });
});
