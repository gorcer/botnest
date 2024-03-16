import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { BalanceService, OperationContext } from '../balance/balance.service';
import { OperationType } from '../balance/entities/balanceLog.entity';
import { ApiService } from '../exchange/api.service';
import { ERRORS_ORDER_NOT_FOUND } from '../exchange/errorCodes';
import { add, compareTo, divide, multiply, subtract } from '../helpers/bc';
import { extractCurrency, lock, SEC_IN_YEAR } from '../helpers/helpers';
import { FileLogService } from '../log/filelog.service';
import { UpdateOrderDto } from '../order/dto/update-order.dto';
import { Order, OrderSideEnum } from '../order/entities/order.entity';
import { OrderService } from '../order/order.service';
import { RequestSellInfoDto } from '../strategy/dto/request-sell-info.dto';
import { AccountService } from '../user/account.service';
import { FeeService } from './fee.service';

@Injectable()
export class CloseOrderService {
  constructor(
    public balance: BalanceService,
    private orders: OrderService,
    private log: FileLogService,
    private apiService: ApiService,
    private eventEmitter: EventEmitter2,
    private feeService: FeeService,
    private accounts: AccountService,
  ) {}

  public async create(orderInfo: RequestSellInfoDto): Promise<Order> {
    const price = orderInfo.rate;
    let closeOrder: Order;
    const api = await this.accounts.getApiForAccount(orderInfo.accountId);
    const pairName = orderInfo.pairName;
    const { currency1, currency2 } = extractCurrency(pairName);

    this.log.info(orderInfo.accountId + ': Try to close order');

    const extOrder = await this.apiService.createOrder(
      api,
      pairName,
      'limit',
      'sell',
      orderInfo.needSell,
      price,
    );

    const amount2 = extOrder.cost || multiply(extOrder.amount, extOrder.price);
    let amount2_in_usd = amount2;

    if (currency2 != 'USDT') {
      const usdRate = await this.apiService.getLastPrice(
        api,
        currency2 + '/USDT',
      );
      amount2_in_usd = multiply(usdRate, amount2);
    }

    if (extOrder.id != undefined) {
      // store in db
      closeOrder = await this.orders.create({
        pairName,
        currency1,
        currency2,
        pairId: orderInfo.pairId,
        extOrderId: extOrder.id,
        expectedRate: price,
        rate: extOrder.price,
        // amount1: api.currencyToPrecision(currency1, extOrder.amount),
        amount1: extOrder.amount,
        amount2,
        amount2_in_usd,
        parentId: orderInfo.id,
        side: OrderSideEnum.SELL,
        accountId: orderInfo.accountId,
        createdAtSec: Math.round(extOrder.timestamp / 1000),
      });
      this.log.info(
        'New close order',
        orderInfo.id,
        ' => ',
        closeOrder.id,
        closeOrder.extOrderId,
        closeOrder.rate,
        closeOrder.amount1,
        closeOrder.amount2,
        extOrder,
      );

      await this.balance.outcome(
        orderInfo.accountId,
        currency1,
        closeOrder.id,
        OperationType.SELL,
        closeOrder.amount1,
        OperationContext.IN_ORDERS,
      );

      await this.orders.update(orderInfo.id, {
        prefilled: add(orderInfo.prefilled, extOrder.amount),
      });

      await this.check(closeOrder, extOrder);
      // await this.eventEmitter.emitAsync('sellOrder.created', orderInfo);
    }

    return closeOrder;
  }

  /**
   * Откат ордера если по какой-то причине он пропал с биржи
   * @param order 
   */
  private async rollback(order: Order) {
    this.log.info(order.accountId + ': Rollback order #' + order.extOrderId);

    await this.balance.income(
      order.accountId,
      order.currency1,
      order.id,
      OperationType.ROLLBACK,
      order.amount1,
      OperationContext.IN_ORDERS,
    );

    const parentOrder = await this.orders.findOne({ id: order.parentId });

    await this.orders.update(parentOrder.id, {
      prefilled: subtract(parentOrder.prefilled, order.amount1),
    });

    await this.orders.update(order.id, {
      isActive: false,
    });

  }

  public async check(order: Order, extOrder?): Promise<Order> {
    const api = await this.accounts.getApiForAccount(order.accountId);
    const { currency1, currency2 } = extractCurrency(order.pairName);

    this.log.info(order.accountId + ': Check close order', order.extOrderId);

    if (!order.isActive || order.side != OrderSideEnum.SELL) return;

    if (!extOrder) {
      try {
      extOrder = await this.apiService.fetchOrder(
        api,
        order.extOrderId,
        order.pairName,
      );
      } catch(e) {
        const apiName = api.name.toLowerCase();
        if (ERRORS_ORDER_NOT_FOUND[apiName].includes(parseInt(e.code))) {
          await this.rollback(order);
          return null;
        }
      }
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

      await this.orders.update(order.id, {
        isActive: false,
        // amount1: api.currencyToPrecision(currency1, extOrder.filled),
        amount1: extOrder.filled,
        filled: extOrder.filled,
        fee_in_usd,
        fee: feeInCurrency2Cost,
        fee1: feeCurrency == currency1 ? feeCost : 0,
        fee2: feeCurrency == currency2 ? feeCost : 0,
        // amount2: api.currencyToPrecision(order.currency2, extOrder.cost),
        amount2: extOrder.cost,
        rate: extOrder.average,
      });

      await this.balance.income(
        order.accountId,
        currency2,
        order.id,
        OperationType.SELL,
        // api.currencyToPrecision(order.currency2, order.amount2),
        order.amount2,
      );
      if (feeCost && feeCurrency) {
        let context = null;
        if (feeCurrency == currency1) {
          context = OperationContext.FOR_FEE;
        }

        await this.balance.outcome(
          order.accountId,
          feeCurrency,
          order.id,
          OperationType.SELL_FEE,
          feeCost,
          context,
        );
      }

      // Fill parent buy-order
      const parentOrder = await this.orders.findOne({ id: order.parentId });
      const updateOrderDto: UpdateOrderDto = {
        filled: add(parentOrder.filled, extOrder.filled),
      };
      if (compareTo(parentOrder.amount1, updateOrderDto.filled) == 0) {
        const totalAmount2 = await this.orders.getSumByParentId(
          parentOrder.id,
          'amount2',
        );
        updateOrderDto.isActive = false;
        updateOrderDto.profit = subtract(
          subtract(
            subtract(totalAmount2, parentOrder.amount2),
            feeInCurrency2Cost,
          ),
          parentOrder.fee,
        );
        updateOrderDto.anualProfitPc =
          100 *
          divide(
            multiply(
              SEC_IN_YEAR,
              divide(
                updateOrderDto.profit,
                subtract(order.createdAtSec, parentOrder.createdAtSec),
                15,
              ),
            ),
            parentOrder.amount2,
            15,
          );

        updateOrderDto.closedAt = () => 'now()';

        this.log.info(
          'Order closed',
          parentOrder.id,
          '=>',
          order.id,
          'Profit: ',
          updateOrderDto.profit,
          extOrder,
        );

        await this.eventEmitter.emitAsync('buyOrder.closed', {
          feeCurrency,
          feeCost,
          orderInfo: {
            account_id: parentOrder.accountId,
            amount1: parentOrder.amount1,
            amount2: parentOrder.amount2,
            currency1: parentOrder.currency1,
            fee: parentOrder.fee1,
          },
        });
      }
      await this.orders.update(parentOrder.id, updateOrderDto);
      return order;
    }

    return null;
  }
}
