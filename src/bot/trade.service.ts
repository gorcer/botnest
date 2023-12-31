import { Injectable } from '@nestjs/common';
import { BalanceService } from '../balance/balance.service';
import { OrderService } from '../order/order.service';
import { Order, OrderSideEnum } from '../order/entities/order.entity';
import { UpdateOrderDto } from '../order/dto/update-order.dto';
import { lock, SEC_IN_YEAR, extractCurrency, sleep } from '../helpers/helpers';
import { ApiService } from '../exchange/api.service';
import { FileLogService } from '../log/filelog.service';
import { AccountService } from '../user/account.service';
import { OperationType } from '../balance/entities/balanceLog.entity';
import { RequestSellInfoDto } from '../strategy/dto/request-sell-info.dto';
import { StrategyService } from '../strategy/strategy.service';
import { BuyStrategyInterface } from '../strategy/interfaces/buyStrategy.interface';
import { SellStrategyInterface } from '../strategy/interfaces/sellStrategy.interface';
import { add, compareTo, divide, multiply, subtract } from '../helpers/bc';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { TradeCheckService } from './tradeCheck.service';

@Injectable()
export class TradeService {
  buyStrategies: Array<BuyStrategyInterface> = [];
  sellStrategies: Array<SellStrategyInterface> = [];

  constructor(
    public balance: BalanceService,
    private orders: OrderService,
    private log: FileLogService,

    private accounts: AccountService,
    private strategies: StrategyService,
    private apiService: ApiService,

    private eventEmitter: EventEmitter2,
    private tradeCheck: TradeCheckService,
  ) {}

  private api(accountId: number) {
    return this.accounts.getApiForAccount(accountId);
  }

  public async addStrategy(strategyService) {
    const strategy = this.strategies.getStrategy(strategyService);
    if (strategy.side == OrderSideEnum.BUY) {
      this.buyStrategies.push(strategy);
    } else {
      this.sellStrategies.push(strategy);
    }
  }

  async runBuyStrategies() {
    const orders = [];
    const result = [];

    for (const strategy of this.buyStrategies) {
      this.log.info(strategy.constructor.name + ': Find accounts to buy....');
      const accounts = await strategy.get();
      this.log.info(
        strategy.constructor.name + ': Ok....' + accounts.length + ' accounts',
      );
      for (const account of accounts) {
        result.push(
          this.createBuyOrder(account).then((order) => {
            orders.push(order);
          }),
        );
      }
    }

    await Promise.all(result);
    return orders;
  }

  async runSellStrategies() {
    const result = [];
    const orders = [];

    for (const strategy of this.sellStrategies) {
      this.log.info(strategy.constructor.name + ': Get active orders....');
      const tm = Date.now();
      const orderInfos = await strategy.get();

      this.log.info(
        strategy.constructor.name +
          ': Ok...' +
          orderInfos.length +
          ' orders ..' +
          (Date.now() - tm) / 1000 +
          ' sec',
      );

      for (const orderInfo of orderInfos) {
        result.push(
          this.createCloseOrder(orderInfo).then((order) => {
            orders.push(order);
          }),
        );
      }
    }

    await Promise.all(result);
    return orders;
  }

  public async checkCloseOrder(order: Order, extOrder?): Promise<Order> {
    const api = await this.api(order.accountId);
    const { currency2 } = extractCurrency(order.pairName);

    return await lock.acquire('Balance' + order.accountId, async () => {
      this.log.info('Check close order', order.extOrderId);

      if (!order.isActive || order.side != OrderSideEnum.SELL) return;

      if (!extOrder)
        extOrder = await this.apiService.fetchOrder(
          api,
          order.extOrderId,
          order.pairName,
        );

      if (compareTo(extOrder.filled, extOrder.amount) == 0) {
        const { feeCost, feeInCurrency2Cost, feeCurrency } =
          await this.extractFee(api, extOrder.fees, currency2);

        await this.orders.update(order.id, {
          isActive: false,
          amount1: api.currencyToPrecision(order.currency1, extOrder.filled),
          filled: extOrder.filled,
          fee: feeInCurrency2Cost,
          amount2: api.currencyToPrecision(order.currency2, extOrder.cost),
          rate: extOrder.average,
        });

        await this.balance.income(
          order.accountId,
          currency2,
          order.id,
          OperationType.SELL,
          api.currencyToPrecision(order.currency2, order.amount2),
        );
        if (feeCost && feeCurrency) {
          await this.balance.outcome(
            order.accountId,
            feeCurrency,
            order.id,
            OperationType.SELL_FEE,
            api.currencyToPrecision(feeCurrency, feeCost),
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
        }
        await this.orders.update(parentOrder.id, updateOrderDto);
        return order;
      }

      return false;
    });
  }

  async extractFee(
    api: ApiService,
    feeObj: { cost: number; currency: string }[],
    currency2: string,
  ) {
    const fee = feeObj[0];
    const feeCost = feeObj[0]?.cost ?? 0;
    const feeInCurrency2Cost = await this.calculateFee(
      api,
      feeObj[0],
      currency2,
    );
    const feeCurrency = fee?.currency;

    return { feeCost, feeInCurrency2Cost, feeCurrency };
  }

  public async createBuyOrder(orderInfo) {
    const { accountId, pairName, rate: price, amount2 } = orderInfo;
    const api = await this.api(accountId);
    const amount1 = divide(amount2, price);

    const result = await lock.acquire('Balance' + accountId, async () => {
      this.log.info('Try to buy', price, amount1, amount2);

      const extOrder = await this.apiService.createOrder(
        api,
        pairName,
        'market',
        'buy',
        amount1,
        price,
      );

      if (extOrder.id != undefined) {
        this.tradeCheck.open(extOrder.id, { orderInfo, extOrder });

        const { currency1, currency2 } = extractCurrency(pairName);

        const { feeCost, feeInCurrency2Cost, feeCurrency } =
          await this.extractFee(api, extOrder.fees, currency2);

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
          accountId: orderInfo.accountId,
          createdAtSec: Math.round(extOrder.timestamp / 1000),
        });

        this.tradeCheck.close(extOrder.id);

        await this.balance.income(
          accountId,
          currency1,
          order.id,
          OperationType.BUY,
          order.amount1,
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

        return { extOrder, order };
      }
      return false;
    });

    if (result.extOrder.id != undefined) {
      await this.eventEmitter.emitAsync('buyOrder.created', orderInfo);
    }

    return result;
  }

  private async calculateFee(
    api: ApiService,
    fee: { cost: number; currency: string },
    currency2: string,
  ) {
    if (!fee || !fee.cost || fee.cost == 0) return 0;

    if (!fee.currency) return fee.cost;

    if (fee.currency != currency2) {
      const pair = fee.currency + '/' + currency2;
      const lastPrice = await this.apiService.getLastPrice(api, pair);
      if (!lastPrice) {
        throw new Error('Unknown fee pair' + lastPrice);
      }

      return multiply(fee.cost, lastPrice);
    } else {
      return fee.cost;
    }
  }

  public async createCloseOrder(orderInfo: RequestSellInfoDto): Promise<Order> {
    const price = orderInfo.rate;
    let closeOrder: Order;
    const api = await this.api(orderInfo.accountId);
    const pairName = orderInfo.pairName;
    const { currency1, currency2 } = extractCurrency(pairName);
    let extOrder;

    
    await lock.acquire('Balance' + orderInfo.accountId, async () => {
      console.log('Order close start ...');
      extOrder = await this.apiService.createOrder(
        api,
        pairName,
        'limit',
        'sell',
        orderInfo.needSell,
        price,
      );

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
          amount1: api.currencyToPrecision(currency1, extOrder.amount),
          amount2: api.currencyToPrecision(
            currency2,
            extOrder.cost || multiply(extOrder.amount, extOrder.price),
          ),
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
          true,
        );

        await this.orders.update(orderInfo.id, {
          prefilled: add(orderInfo.prefilled, extOrder.amount),
        });
        
      }
      console.log('Order close ok ...');
    });

    if (extOrder.id) {
      // You cant move it up due node lock
      await this.checkCloseOrder(closeOrder, extOrder);

      await this.eventEmitter.emitAsync('sellOrder.created', orderInfo);
    }

    


    return closeOrder;
  }

  async checkCloseOrders(): Promise<Array<Order>> {
    const closedOrders: Array<Order> = [];
    const orders = await this.orders.findAll({
      isActive: true,
      side: OrderSideEnum.SELL,
    });
    for (const order of orders) {
      try {
        const closedOrder = await this.checkCloseOrder(order);
        if (closedOrder) closedOrders.push(closedOrder);
      } catch (e) {
        this.log.error(
          'Check order ' + order.extOrderId + ' error...wait 1 sec',
          e.message,
          e.stack,
        );
        await sleep(1);
      }
    }

    return closedOrders;
  }
}
