import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { BalanceService } from '../balance/balance.service';
import { OperationType } from '../balance/entities/balanceLog.entity';
import { ApiService } from '../exchange/api.service';
import { PairService } from '../exchange/pair.service';
import { add, compareTo, divide, multiply, subtract } from '../helpers/bc';
import { extractCurrency, roundUp } from '../helpers/helpers';
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
        private pairService: PairService,
    ) { }

    public async create(orderInfo) {
        const { accountId, pairName, rate: price, amount2, pairId } = orderInfo;
        const api = await this.accounts.getApiForAccount(accountId);
        const amount1 = divide(amount2, price);
        const { currency1, currency2 } = extractCurrency(pairName);

        // // fee transport = 0.00000479699
        // // amount1 = "0.00479699"
        // // buy "0.00480178699" => 0.0048
        // // real buy 0.00479
        // // price 41692.85
        // const balance = await this.balance.getBalance(accountId, currency1);
        // let feeTransport = subtract(multiply(amount1, fee), balance.available);
        // if (compareTo(feeTransport, 0) < 0) feeTransport = 0;
        // const market = api.market(pairName);
        // let precision = market['precision']['amount'];
        // if (compareTo(precision, 1) < 0) {
        //   //10e-8 = > 8
        //   precision = -Math.floor(Math.log10(precision));
        // }
        // let orderablaAmount = add(amount1, feeTransport);
        // orderablaAmount = roundUp(orderablaAmount, precision);


        this.checkAndImproveFeeBalance(accountId, pairId, amount1);

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
                amount1: api.currencyToPrecision(
                    currency1,
                    extOrder.filled,
                ),
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

            //   await this.balance.income(
            //     accountId,
            //     currency1,
            //     order.id,
            //     OperationType.FEE_TRANSPORT,
            //     api.currencyToPrecision(currency1, subtract(extOrder.filled, amount1)),
            //   );

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

    private async checkAndImproveFeeBalance(accountId, pairId, amount1) {

        const pair = await this.pairService.get(pairId);
        let feeAmount = multiply(amount1, pair.fee);
        const balance = await this.balance.getBalance(accountId, pair.currency1);
        let feeTransport = subtract(feeAmount, balance.available);
        if (compareTo(feeTransport, 0) < 0)
            return;


        if (compareTo(pair.minAmount1, feeAmount) > 0) {
            feeAmount = pair.minAmount1;
        }

        const api = await this.accounts.getApiForAccount(accountId);

        this.log.info('Try to make fee transfer');
        const extOrder = await this.apiService.createOrder(
            api,
            pair.name,
            'market',
            'buy',
            feeAmount,
            pair.sellRate          
        );

        if (extOrder.id != undefined) {
            await this.balance.income(
                accountId,
                pair.currency1,
                null,
                OperationType.FEE_TRANSPORT,
                api.currencyToPrecision(pair.currency1, extOrder.filled),
            );

            this.log.info(
                'New fee transfer',
                extOrder.id,
                extOrder.price,
                extOrder.filled,
                extOrder.cost,
                extOrder,
            );
        }

    }
}
