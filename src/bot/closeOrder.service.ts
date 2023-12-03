import { Injectable } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { BalanceService } from "../balance/balance.service";
import { OperationType } from "../balance/entities/balanceLog.entity";
import { ApiService } from "../exchange/api.service";
import { add, compareTo, divide, multiply, subtract } from "../helpers/bc";
import { extractCurrency, lock, SEC_IN_YEAR } from "../helpers/helpers";
import { FileLogService } from "../log/filelog.service";
import { UpdateOrderDto } from "../order/dto/update-order.dto";
import { Order, OrderSideEnum } from "../order/entities/order.entity";
import { OrderService } from "../order/order.service";
import { RequestSellInfoDto } from "../strategy/dto/request-sell-info.dto";
import { AccountService } from "../user/account.service";
import { FeeService } from "./fee.service";

@Injectable()
export class CloseOrderService {

    constructor(
        public balance: BalanceService,
        private orders: OrderService,
        private log: FileLogService,        
        private apiService: ApiService,
        private eventEmitter: EventEmitter2,        
        private feeService: FeeService,
        private accounts: AccountService
    ) { }

    public async create(orderInfo: RequestSellInfoDto): Promise<Order> {
        const price = orderInfo.rate;
        let closeOrder: Order;
        const api = await this.accounts.getApiForAccount(orderInfo.accountId);
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
          await this.check(closeOrder, extOrder);
    
          await this.eventEmitter.emitAsync('sellOrder.created', orderInfo);
        }
    
        return closeOrder;
      }

      public async check(order: Order, extOrder?): Promise<Order> {
        
        const api = await this.accounts.getApiForAccount(order.accountId);
        const { currency1, currency2 } = extractCurrency(order.pairName);
    
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
              await this.feeService.extractFee(api, extOrder.fees, currency2);
    
            await this.orders.update(order.id, {
              isActive: false,
              amount1: api.currencyToPrecision(currency1, extOrder.filled),
              filled: extOrder.filled,
              fee: feeInCurrency2Cost,
              fee1: feeCurrency == currency1 ? feeCost : 0,
              fee2: feeCurrency == currency2 ? feeCost : 0,
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
}