import { Test, TestingModule } from '@nestjs/testing';
import { Repository } from 'typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AccountService } from '../../user/account.service';
import { Account } from '../../user/entities/account.entity';
import { TradeService } from '../trade.service';
import { BalanceService } from '../../balance/balance.service';
import { PairService } from '../../exchange/pair.service';
import { MockedExchange } from '../../exchange/mock/mocked.exchange';
import { TestingModuleCreate } from './TestingModuleCreate';
import { equal, notEqual } from 'assert';
import { ApiService } from '../../exchange/api.service';
import { RequestSellInfoDto } from '../../strategy/dto/request-sell-info.dto';
import { Order } from '../../order/entities/order.entity';
import { SEC_IN_YEAR } from '../../helpers';
const { divide, subtract, multiply, compareTo, add } = require("js-big-decimal");

describe('OrderService', () => {
  let accounts: AccountService;
  let bot: TradeService;
  let balances: BalanceService;
  let pairs: PairService;
  let publicExchange: MockedExchange;
  let api: ApiService;

  beforeEach(async () => {
    ({ bot, pairs, publicExchange, balances, api } = await TestingModuleCreate());

  });

  it('should be defined', () => {
    expect(bot).toBeDefined();
  });


  it('simple buy / close order', async () => {

    // Параметры теста
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
    const expectedProfit = ((sellPrice - buyPrice) * amount) - buyFeeCost - (sellFeeCost * BNBUSDTRate);

    publicExchange.setTickers({
      'BNB/USDT': {
        last: BNBUSDTRate
      }
    });
    publicExchange.setNextOrderBook(
      buyPrice, buyPrice
    );
    await balances.set(accountId, await api.fetchBalances());
    const pair = await pairs.fetchOrCreate(pairName);
    await pairs.actualize(pair)
    let balanceBTC: number = await bot.balance.getBalanceAmount(accountId, 'BTC');
    let balanceUSDT: number = await bot.balance.getBalanceAmount(accountId, 'USDT');
    let balanceBNB: number = await bot.balance.getBalanceAmount(accountId, 'BNB');

    // Подготавливаем данные для покупки    
    publicExchange.setNextOrder({
      price: buyPrice,
      amount: amount,
      cost: buyCost,
      fees: [{
        cost: buyFeeCost,
        currency: 'USDT',
      }]
    });

    // Покупаем ------------------------------
    let extOrder, order: Order;
    {
      const result = await bot.createBuyOrder(accountId, pair.id, pair.name, buyPrice, amount);
      notEqual(result, false);
      if (result != false) {
        ({ extOrder, order } = result);
        expect(extOrder.id).toBeDefined();
        expect(order.id).toBeDefined();
        // console.log(extOrder, order);

        balanceBTC = add(balanceBTC, amount);
        balanceUSDT = subtract(subtract(balanceUSDT, buyCost), buyFeeCost);
        equal(balanceBTC, await bot.balance.getBalanceAmount(accountId, 'BTC'));
        equal(balanceUSDT, await bot.balance.getBalanceAmount(accountId, 'USDT'));
      }
    }



    // Продаем ------------ 
    let closeOrder: Order;
    {
      publicExchange.setNextOrder({
        price: sellPrice,
        amount: amount,
        cost: sellCost,
        fees: [{
          cost: sellFeeCost,
          currency: 'BNB',
        }]
      });

      const orderInfo = {
        ...order,
        ...{
          rate: sellPrice,
          needSell: amount
        }
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
      publicExchange.setNextOrder({
        price: sellPrice,
        amount: amount,
        cost: sellCost,
        fees: [{
          cost: 0
        }],
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
      publicExchange.setNextOrder({
        price: sellPrice,
        amount: amount,
        cost: sellCost,
        fees: [{
          cost: sellFeeCost,
          currency: 'BNB',
        }],
        filled: amount,
      });

      await bot.checkCloseOrder(closeOrder);

      equal(closeOrder.filled, amount);
      equal(order.profit, expectedProfit);

      const elapsed = subtract(closeOrder.createdAtSec, order.createdAtSec);
      const profitPerSec = divide(order.profit, elapsed, 15);
      const profitPerYear = multiply(SEC_IN_YEAR, profitPerSec);
      const anualProfit = 100*divide(profitPerYear,  order.amount2);
      equal(order.anualProfitPc - anualProfit, 0);

      balanceUSDT = add(balanceUSDT, sellCost);
      equal(balanceUSDT, await bot.balance.getBalanceAmount(accountId, 'USDT'));

      balanceBNB = subtract(balanceBNB, sellFeeCost);
      equal(balanceBNB, await bot.balance.getBalanceAmount(accountId, 'BNB'));
    }
  });

});
