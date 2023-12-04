import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { BalanceService } from '../balance/balance.service';
import { OperationType } from '../balance/entities/balanceLog.entity';
import { ApiService } from '../exchange/api.service';
import { add, divide, multiply, subtract } from '../helpers/bc';
import { extractCurrency, lock } from '../helpers/helpers';
import { FileLogService } from '../log/filelog.service';
import { OrderSideEnum } from '../order/entities/order.entity';
import { OrderService } from '../order/order.service';
import { AccountService } from '../user/account.service';
import { FeeService } from './fee.service';
import { TradeCheckService } from './tradeCheck.service';

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
  ) {}

  public async create(orderInfo) {
    const { accountId, pairName, rate: price, amount2, fee } = orderInfo;
    const api = await this.accounts.getApiForAccount(accountId);
    const amount1 = divide(amount2, price);
    const { currency1, currency2 } = extractCurrency(pairName);
    

    const balance = await this.balance.getBalance(accountId, currency1);
    const feeTransport = subtract(balance.available, multiply(amount1, fee));

    const orderablaAmount = add(amount1, feeTransport);

    this.log.info('Try to buy', price, amount1, amount2);
    const extOrder = await this.apiService.createOrder(
      api,
      pairName,
      'market',
      'buy',
      orderablaAmount,
      price,
    );

    if (extOrder.id != undefined) {
      this.tradeCheck.open(extOrder.id, { orderInfo, extOrder });

      const { feeCost, feeInCurrency2Cost, feeCurrency } =
        await this.feeService.extractFee(api, extOrder.fees, currency2);

      const fee1 = feeCurrency == currency1 ? feeCost : 0;
      const fee2 = feeCurrency == currency2 ? feeCost : 0;

      const order = await this.orders.create({
        side: OrderSideEnum.BUY,
        pairId: orderInfo.pairId,
        pairName: orderInfo.pairName,
        currency1,
        currency2,
        extOrderId: extOrder.id,
        expectedRate: price,
        rate: extOrder.price,
        amount1: api.currencyToPrecision(currency1, extOrder.filled),
        amount2: api.currencyToPrecision(
          currency2,
          extOrder.cost || multiply(extOrder.amount, extOrder.average),
        ),
        fee: feeInCurrency2Cost,
        fee1,
        fee2,
        accountId: orderInfo.accountId,
        createdAtSec: Math.round(extOrder.timestamp / 1000),
      });

      this.tradeCheck.close(extOrder.id);

      await this.balance.income(
        accountId,
        currency1,
        order.id,
        OperationType.FEE_TRANSPORT,
        api.currencyToPrecision(currency1, subtract(extOrder.filled, amount1))       
      );

      await this.balance.income(
        accountId,
        currency1,
        order.id,
        OperationType.BUY,
        extOrder.filled,
        true,
      );
      await this.balance.outcome(
        accountId,
        currency2,
        order.id,
        OperationType.BUY,
        order.amount2,
      );

      if (feeCost && feeCurrency) {
        await this.balance.outcome(
          accountId,
          feeCurrency,
          order.id,
          OperationType.BUY_FEE,
          api.currencyToPrecision(feeCurrency, feeCost),
        );
      }

      this.log.info(
        'New order',
        order.extOrderId,
        order.rate,
        order.amount1,
        order.amount2,
        extOrder,
      );

      if (extOrder.id != undefined) {
        await this.eventEmitter.emitAsync('buyOrder.created', orderInfo);
      }
      return { extOrder, order };
    } else {
      return false;
    }
  }
}
