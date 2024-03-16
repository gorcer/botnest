import { TradeService } from '../trade.service';
import { BalanceService } from '../../balance/balance.service';
import { PairService } from '../../exchange/pair.service';
import { DummyExchange } from '../../exchange/mock/dummy.exchange';
import { TestingModuleCreate } from '../../test-utils/TestingModuleCreate';
import { equal, notEqual } from 'assert';
import { ApiService } from '../../exchange/api.service';
import { Order } from '../../order/entities/order.entity';
import { SEC_IN_YEAR } from '../../helpers/helpers';
import { add, divide, multiply, subtract } from '../../helpers/bc';

describe('OrderService', () => {
  let bot: TradeService;
  let balances: BalanceService;
  let pairs: PairService;
  let api;
  let publicApi, apiService;

  beforeEach(async () => {
    ({ bot, pairs, balances, api, publicApi, apiService } =
      await TestingModuleCreate());
  });

  it('should be defined', () => {
    expect(bot).toBeDefined();
  });

  it('simple buy / close order', async () => {
    // Параметры теста
    const exchange_id = 1;
    const accountId = 1;
    const buyPrice = 1000;
    const amount = 0.001;
    const buyCost = buyPrice * amount;
    const sellPrice = 1100;
    const sellCost = sellPrice * amount;
    const buyFeeCost = 0.01;
    const sellFeeCost = 0.001;
    const BNBUSDTRate = 20;
    const pairName = 'BTC/USDT';
    const expectedProfit =
      (sellPrice - buyPrice) * amount - buyFeeCost - sellFeeCost * BNBUSDTRate;

    api.setTickers({
      'BNB/USDT': {
        last: BNBUSDTRate,
      },
    });
    api.setNextOrderBook(buyPrice, buyPrice);
    await balances.set(accountId, await apiService.fetchBalances(api));
    const pair = await pairs.fetchOrCreate(exchange_id, pairName);
    await pairs.actualize(publicApi, pair.name, exchange_id);
    let balanceBTC: number = await bot.balance.getBalanceAmount(
      accountId,
      'BTC',
    );
    let balanceUSDT: number = await bot.balance.getBalanceAmount(
      accountId,
      'USDT',
    );
    let balanceBNB: number = await bot.balance.getBalanceAmount(
      accountId,
      'BNB',
    );

    // Подготавливаем данные для покупки
    api.setNextOrder({
      price: buyPrice,
      amount: amount,
      cost: buyCost,
      fees: [
        {
          cost: buyFeeCost,
          currency: 'USDT',
        },
      ],
    });

    // Покупаем ------------------------------
    let extOrder, order: Order;
    {
      const result = await bot.createBuyOrder(
        accountId,
        pair.id,
        pair.name,
        buyPrice,
        amount,
      );
      notEqual(result, false);
      if (result != false) {
        ({ extOrder, order } = result);
        expect(extOrder.id).toBeDefined();
        expect(order.id).toBeDefined();
        // console.log(extOrder, order);

        balanceBTC = add(balanceBTC, amount);
        balanceUSDT = subtract(subtract(balanceUSDT, buyCost), buyFeeCost);
        equal(balanceBTC, await bot.balance.getBalanceAmount(accountId, 'BTC'));
        equal(
          balanceUSDT,
          await bot.balance.getBalanceAmount(accountId, 'USDT'),
        );
      }
    }

    // Продаем ------------
    let closeOrder: Order;
    {
      api.setNextOrder({
        price: sellPrice,
        amount: amount,
        cost: sellCost,
        fees: [
          {
            cost: sellFeeCost,
            currency: 'BNB',
          },
        ],
      });

      const orderInfo = {
        ...order,
        ...{
          rate: sellPrice,
          needSell: amount,
        },
      };
      closeOrder = await bot.createCloseOrder(orderInfo);
      equal(order.prefilled, amount);
      equal(closeOrder.parentId, 1);
      equal(closeOrder.accountId, 1);

      balanceBTC = subtract(balanceBTC, amount);
      equal(balanceBTC, await bot.balance.getBalanceAmount(accountId, 'BTC'));
    }

    // Частичное закрытие заявки ----------------------
    {
      api.setNextOrder({
        price: sellPrice,
        amount: amount,
        cost: sellCost,
        fees: [
          {
            cost: 0,
          },
        ],
        filled: amount / 2,
      });

      // Проверяем закрытие заявки
      await bot.checkCloseOrder(closeOrder);

      // Ничего не должно закрыться, она будет висеть пока не придет полная сумма
      equal(closeOrder.filled, 0);
      equal(order.profit, 0);
    }

    // Проверяем закрытие заявки ---------------------------------
    {
      api.setNextOrder({
        price: sellPrice,
        amount: amount,
        cost: sellCost,
        fees: [
          {
            cost: sellFeeCost,
            currency: 'BNB',
          },
        ],
        filled: amount,
      });

      await bot.checkCloseOrder(closeOrder);

      equal(closeOrder.filled, amount);
      equal(order.profit, expectedProfit);

      const elapsed = subtract(closeOrder.createdAtSec, order.createdAtSec);
      const profitPerSec = divide(order.profit, elapsed, 15);
      const profitPerYear = multiply(SEC_IN_YEAR, profitPerSec);
      const anualProfit = 100 * divide(profitPerYear, order.amount2);
      equal(order.anualProfitPc - anualProfit, 0);

      balanceUSDT = add(balanceUSDT, sellCost);
      equal(balanceUSDT, await bot.balance.getBalanceAmount(accountId, 'USDT'));

      balanceBNB = subtract(balanceBNB, sellFeeCost);
      equal(balanceBNB, await bot.balance.getBalanceAmount(accountId, 'BNB'));
    }
  });
});
