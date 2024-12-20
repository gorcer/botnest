import { Injectable } from "@nestjs/common";
import { BalanceService } from "../balance/balance.service";
import { OrderService } from "../order/order.service";
import { Order, OrderSideEnum } from "../order/entities/order.entity";
import { ApiService } from "../exchange/api.service";
import { FileLogService } from "../log/filelog.service";
import { AccountService } from "../user/account.service";
import { StrategyService } from "../strategy/strategy.service";
import { BuyStrategyInterface } from "../strategy/interfaces/buyStrategy.interface";
import { SellStrategyInterface } from "../strategy/interfaces/sellStrategy.interface";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { TradeCheckService } from "./tradeCheck.service";
import { BuyOrderService } from "./buyOrder.service";
import { FeeService } from "./fee.service";
import { CloseOrderService } from "./closeOrder.service";
import { elapsedSecondsFrom, SEC_IN_DAY, sleep } from "../helpers/helpers";
import { LessThan } from 'typeorm';
import { Raw } from 'typeorm';

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
    public buyOrderService: BuyOrderService,
    private closeOrderService: CloseOrderService,
    private feeService: FeeService
  ) {
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
      this.log.info(strategy.constructor.name + ": Find accounts to buy....");
      const accounts = await strategy.get();
      this.log.info(
        strategy.constructor.name + ": Ok...." + accounts.length + " accounts"
      );
      for (const account of accounts) {
        // result.push(
        await this.buyOrderService.create(account).then((order) => {
          orders.push(order);
        });
        // );
      }
    }

    // await Promise.all(result);
    return orders;
  }

  async runSellStrategies() {
    const result = [];
    const orders = [];

    for (const strategy of this.sellStrategies) {
      this.log.info(strategy.constructor.name + ": Get active orders....");
      const tm = Date.now();
      const orderInfos = await strategy.get();

      this.log.info(
        strategy.constructor.name +
        ": Ok..." +
        orderInfos.length +
        " orders .." +
        (Date.now() - tm) / 1000 +
        " sec"
      );

      for (const orderInfo of orderInfos) {
        result.push(
          await this.closeOrderService.create(orderInfo).then((order) => {
            orders.push(order);
          })
        );
      }
    }

    await Promise.all(result);
    return orders;
  }

  async checkLimitOrders(): Promise<Array<Order>> {
    const checkedOrders: Array<Order> = [];
    const orders = await this.orders.findAll({
      isActive: true,
      filled: Raw((alias) => `${alias} < "amount1"`),
    });
    for (const order of orders) {
      try {
        let closedOrder;
        if (order.side == 'sell')
          closedOrder = await this.closeOrderService.check(order);
        else
          closedOrder = await this.buyOrderService.check(order);

        if (closedOrder) checkedOrders.push(closedOrder);
      } catch (e) {
        this.log.error(
          "Check order " + order.extOrderId + " error...wait 1 sec",
          e.message,
          e.stack
        );
        await sleep(1);
      }
    }

    return checkedOrders;
  }
}
