import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { BalanceService, OperationContext } from '../balance/balance.service';
import { OperationType } from '../balance/entities/balanceLog.entity';
import { ApiService } from '../exchange/api.service';
import { PairService } from '../exchange/pair.service';
import { add, compareTo, divide, multiply, subtract } from '../helpers/bc';
import { extractCurrency, roundUp, SEC_IN_YEAR } from '../helpers/helpers';
import { FileLogService } from '../log/filelog.service';
import { Order, OrderSideEnum } from '../order/entities/order.entity';
import { OrderService } from '../order/order.service';
import { RequestBuyInfoDto } from '../strategy/dto/request-buy-info.dto';
import { AccountService } from '../user/account.service';
import { FeeService } from './fee.service';
import { TradeCheckService } from './tradeCheck.service';
import { ERRORS_ORDER_NOT_FOUND } from '../exchange/errorCodes';
import { UpdateOrderDto } from '../order/dto/update-order.dto';

@Injectable()
export class BuyOrderService {
  constructor(
    public balance: BalanceService,
    private orders: OrderService,
    private log: FileLogService,
    private accounts: AccountService,
    private apiService: ApiService,
    private eventEmitter: EventEmitter2,
    private tradeCheck: TradeCheckService,
    private feeService: FeeService,
    private pairService: PairService,
  ) {
  }

  public prepareAmounts(minAmount1, amount2, price) {
    let amount1 = divide(amount2, price);
    if (compareTo(amount1, minAmount1) < 0) {
      amount1 = minAmount1;
      amount2 = multiply(amount1, price);
    }

    return { amount1, amount2 };
  }

  public async create(orderInfo: RequestBuyInfoDto) {
    const { accountId, rate: price, pairId } = orderInfo;

    const api = await this.accounts.getApiForAccount(accountId);
    const pair = await this.pairService.get(pairId);
    const pairName = pair.name;

    const { currency1, currency2 } = extractCurrency(pairName);

    const { amount1, amount2 } = this.prepareAmounts(
      pair.minAmount1,
      orderInfo.amount2,
      price,
    );

    await this.checkAndImproveFeeBalance(accountId, pairId, amount1);

    this.log.info('Try to buy', accountId, price, amount1, amount2);
    const extOrder = await this.apiService.createOrder(
      api,
      pairName,
      'limit',
      'buy',
      amount1,
      price,
    );
    this.log.info(accountId + ': Ok ');

    if (extOrder && extOrder.id != undefined) {

      const amount2 =
        extOrder.cost || multiply(extOrder.amount, (extOrder.average || extOrder.price));
      let amount2_in_usd = amount2;

      if (currency2 != 'USDT') {
        const usdRate = await this.apiService.getLastPrice(
          api,
          currency2 + '/USDT',
        );
        amount2_in_usd = multiply(usdRate, amount2);
      }

      this.tradeCheck.open(extOrder.id, { orderInfo, extOrder });

      const order = await this.orders.create({
        side: OrderSideEnum.BUY,
        pairId: orderInfo.pairId,
        pairName,
        currency1,
        currency2,
        extOrderId: extOrder.id,
        expectedRate: price,
        rate: extOrder.price,
        amount1: extOrder.amount,
        amount2,
        amount2_in_usd,
        accountId: orderInfo.accountId,
        createdAtSec: Math.round(extOrder.timestamp / 1000),
      });

      this.tradeCheck.close(extOrder.id);

      await this.balance.outcome(
        accountId,
        currency2,
        order.id,
        OperationType.BUY,
        order.amount2,
      );


        await this.eventEmitter.emitAsync('buyOrder.created', {
          orderInfo: {
            accountId: order.accountId,
            amount1: order.amount1,
            currency1: order.currency1,
            amount2: order.amount2,
            currency2: order.currency2,
          },
          // feeCurrency,
          // feeCost,
        });



      this.log.info(
        'New buy order',
        order.accountId,
        order.extOrderId,
        order.rate,
        order.amount1,
        order.amount2,
        extOrder,
      );
      return { extOrder, order };
    } else {
      return null;
    }
  }

  public async check(order: Order, extOrder?): Promise<Order> {
    const api = await this.accounts.getApiForAccount(order.accountId);
    const { currency1, currency2 } = extractCurrency(order.pairName);
    const accountId = order.accountId;

    this.log.info(order.accountId + ': Check buy order', order.extOrderId);

    if (!order.isActive || order.side != OrderSideEnum.BUY) return;

    if (!extOrder) {
      try {
        extOrder = await this.apiService.fetchOrder(
          api,
          order.extOrderId,
          order.pairName,
        );
      } catch (e) {
        const apiName = api.name.toLowerCase();
        if (
          ERRORS_ORDER_NOT_FOUND[apiName] != undefined &&
          ERRORS_ORDER_NOT_FOUND[apiName].includes(parseInt(e.code))
        ) {
          // await this.rollback(order);
          await this.rollback(order);
          this.log.error('Order not found');
          return null;
        } else {
          this.log.error('Order not found');
        }
      }
    }

    if (!extOrder) {
      this.log.error('Order not found');
      return null;
    }

    this.log.info(
      'Check buy order',
      order.extOrderId,
      ' => ',
      extOrder,
    );

    if (extOrder.status == 'canceled') {
      await this.rollback(order);
      return null;
    }

    if (compareTo(extOrder.filled, extOrder.amount) == 0) {
      const { feeCost, feeInCurrency2Cost, feeCurrency } =
        await this.feeService.extractFee(api, extOrder.fees, currency2);

      let fee_in_usd = feeInCurrency2Cost;
      if (currency2 != 'USDT') {
        const usdRate = await this.apiService.getLastPrice(
          api,
          currency2 + '/USDT',
        );
        fee_in_usd = multiply(usdRate, feeInCurrency2Cost);
      }

      const amount2 = extOrder.cost || multiply(extOrder.amount, extOrder.price);

      await this.orders.update(order.id, {
        amount1: extOrder.filled,
        filled: extOrder.filled,
        fee_in_usd,
        fee: feeInCurrency2Cost,
        fee1: feeCurrency == currency1 ? feeCost : 0,
        fee2: feeCurrency == currency2 ? feeCost : 0,
        // amount2: api.currencyToPrecision(order.currency2, extOrder.cost),
        amount2,
        rate: extOrder.average,
      });


      await this.balance.income(
        order.accountId,
        currency1,
        order.id,
        OperationType.BUY,
        order.amount1,
        OperationContext.IN_ORDERS,
      );

      if (feeCost && feeCurrency) {
        let context = null;
        if (feeCurrency == currency1) {
          context = OperationContext.FOR_FEE;
        }

        await this.balance.outcome(
          accountId,
          feeCurrency,
          order.id,
          OperationType.BUY_FEE,
          feeCost,
          context,
        );
      }


      return order;
    }

    return null;
  }

  /**
   * @todo подумать про ситуацию когда отменен частично заполненый
   * @param order
   */
  public async rollback(order: Order) {
    this.log.info(order.accountId + ': Rollback order #' + order.extOrderId);

    await this.balance.income(
      order.accountId,
      order.currency2,
      order.id,
      OperationType.ROLLBACK,
      order.amount2,
    );

    await this.eventEmitter.emitAsync('buyOrder.rolledback', {
      orderInfo: {
        accountId: order.accountId,
        amount1: order.amount1,
        currency1: order.currency1,
        amount2: order.amount2,
        currency2: order.currency2,
      },
      // feeCurrency,
      // feeCost,
    });

    await this.orders.update(order.id, {
      isActive: false,
    });

  }

  public async checkAndImproveFeeBalance(accountId, pairId, amount1) {
    const pair = await this.pairService.get(pairId);
    let feeAmount = multiply(amount1, pair.fee);
    const balance = await this.balance.getBalance(accountId, pair.currency1);
    const price = pair.sellRate;


    feeAmount = subtract(feeAmount, balance.for_fee);
    if (compareTo(feeAmount, 0) <= 0) return;

    if (compareTo(pair.minAmount1, feeAmount) > 0) {
      feeAmount = pair.minAmount1;
    }

    if (compareTo(pair.minAmount2, multiply(feeAmount, price)) > 0) {
      feeAmount = divide(pair.minAmount2, price);
    }

    const api = await this.accounts.getApiForAccount(accountId);

    this.log.info(
      accountId + ': ' + pair.name + ' Try to make fee transfer ' + feeAmount + ' ' + pair.currency1 + ' / ' + (multiply(feeAmount, price)) + ' ' + pair.currency2,
    );
    const symbol = pair.name;
    const extOrder = await this.apiService.createOrder(
      api,
      symbol,
      'market',
      'buy',
      feeAmount,
      price,
    );

    if (extOrder && extOrder.id != undefined) {
      const { currency1, currency2 } = pair;


      const { feeCost, feeCurrency } = await this.feeService.extractFee(
        api,
        // @ts-ignore
        extOrder.fees,
        currency2,
      );

      await this.balance.income(
        accountId,
        currency1,
        null,
        OperationType.FEE_TRANSPORT,
        // api.currencyToPrecision(pair.currency1, extOrder.filled),
        extOrder.filled,
        OperationContext.FOR_FEE,
      );

      const amount2 =
        extOrder.cost || multiply(extOrder.amount, extOrder.average);
      await this.balance.outcome(
        accountId,
        currency2,
        null,
        OperationType.FEE_TRANSPORT,
        // api.currencyToPrecision(
        //     pair.currency2,
        //     extOrder.cost || multiply(extOrder.amount, extOrder.average),
        // ),
        amount2,
      );

      if (feeCost && feeCurrency) {
        await this.balance.outcome(
          accountId,
          feeCurrency,
          null,
          OperationType.BUY_FEE,
          // api.currencyToPrecision(feeCurrency, feeCost),
          feeCost,
          OperationContext.FOR_FEE,
        );
      }

      this.log.info(
        'New fee transfer',
        extOrder.id,
        extOrder.price,
        extOrder.filled,
        extOrder.cost,
        extOrder,
      );

      await this.eventEmitter.emitAsync('fee.transferred', {
        orderInfo: {
          accountId: accountId,
          amount1: extOrder.filled,
          currency1,
          amount2,
          currency2,
        },
        feeCurrency,
        feeCost,
      });
    }
  }

}
