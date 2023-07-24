import { Inject, Injectable } from "@nestjs/common";
import { BaseApiService } from "../binance/baseApi.service";
import { BalanceService } from "../balance/balance.service";
import { OrderService } from "../order/order.service";
import { LogService } from "../log.service";
import { Order, OrderType } from "../order/entities/order.entity";
const { divide } = require( "js-big-decimal" );

const { multiply, compareTo } = require("js-big-decimal");


//https://stackoverflow.com/questions/71306315/how-to-pass-constructor-arguments-to-a-nestjs-provider
// https://docs.nestjs.com/fundamentals/custom-providers

@Injectable()
export class BotService {
    
    config:{
        pair: string,
        orderAmount: number,
        currency1: string,
        currency2: string,
        orderProbability: number,
        minDailyProfit: number,
        minYearlyProfit: number,
        minRateMarginToProcess: number
    };

constructor(
    
    private balance: BalanceService,
    private order: OrderService,
    private log: LogService,

    @Inject('API')
    private api: BaseApiService,
    

) {    
    this.config = {
        pair: process.env.BOT_CURRENCY1 +'/'+ process.env.BOT_CURRENCY2,
        orderAmount: Number( process.env.BOT_ORDER_AMOUNT ),
        currency1: process.env.BOT_CURRENCY1,
        currency2: process.env.BOT_CURRENCY2,
        orderProbability: Number( process.env.BOT_ORDER_PROBABILITY ),
        minDailyProfit: Number(process.env.BOT_MIN_DAILY_PROFIT), // % годовых если сделка закрывается за день
        minYearlyProfit: Number(process.env.BOT_MIN_YERLY_PROFIT), // % годовых если сделка живет больше дня
        minRateMarginToProcess: 0.001, // минимальное движение курса для проверки х100=%
    }
}


async trade() {

    let lastAsk:number=1, lastBid:number=1;

    this.syncData();

    while(true) {

        // actualize orders
        this.api.watchTrades(this.config.pair).then(trades => {
            
            for (const trade of trades) {
                if (trade.side == 'buy') 
                continue;

                // {
                //     info: {
                //       e: 'executionReport',
                //       E: 1690209555747,
                //       s: 'BTCUSDT',
                //       c: 'x-R4BD3S824e8a169dd9014728879c8a',
                //       S: 'BUY',
                //       o: 'MARKET',
                //       f: 'GTC',
                //       q: '0.00100000',
                //       p: '0.00000000',
                //       P: '0.00000000',
                //       F: '0.00000000',
                //       g: -1,
                //       C: '',
                //       x: 'TRADE',
                //       X: 'FILLED',
                //       r: 'NONE',
                //       i: 8887806,
                //       l: '0.00100000',
                //       z: '0.00100000',
                //       L: '29079.13000000',
                //       n: '0.00000000',
                //       N: 'BTC',
                //       T: 1690209555747,
                //       t: 2590175,
                //       I: 20360625,
                //       w: false,
                //       m: false,
                //       M: true,
                //       O: 1690209555747,
                //       Z: '29.07913000',
                //       Y: '29.07913000',
                //       Q: '0.00000000',
                //       W: 1690209555747,
                //       V: 'NONE'
                //     },
                //     timestamp: 1690209555747,
                //     datetime: '2023-07-24T14:39:15.747Z',
                //     symbol: 'BTC/USDT',
                //     id: '2590175',
                //     order: '8887806',
                //     type: 'market',
                //     takerOrMaker: 'taker',
                //     side: 'buy',
                //     price: 29079.13,
                //     amount: 0.001,
                //     cost: 29.07913,
                //     fee: { cost: 0, currency: 'BTC' },
                //     fees: [ [Object] ]
                //   }

            }

        });

        // trade
        const ratesInfo = await this.api.getActualRates(this.config.pair);
        if (!ratesInfo) {
            continue;
        }

        const {bid: rateBid, ask: rateAsk}  = ratesInfo;
        const bidMargin = divide(Math.abs(lastBid - rateBid) , lastBid, 15);
        const askMargin = divide(Math.abs(lastAsk - rateAsk) , lastAsk, 15);

        console.log(rateBid,bidMargin, rateAsk, askMargin);


        if (!lastBid || compareTo(bidMargin, this.config.minRateMarginToProcess)<0)
            continue;

        if (!lastAsk || compareTo(askMargin, this.config.minRateMarginToProcess)<0)
            continue;

        await this.tryToBuy(rateAsk);
        await this.tryToSell(rateBid);

        lastBid = rateBid;
        lastAsk = rateAsk;
    }

}



private async tryToBuy(rate:number) {
    const amount1:number = this.config.orderAmount;
    const amount2:number = multiply(rate, amount1);
    const balance2:number = await this.balance.getBalanceAmount(this.config.currency2);

    if (
        this.canBuy() &&
        compareTo(balance2, amount2) > 0) {
            await this.createBuyOrder(rate, amount1);
        }
}

private canBuy() {
    // Пока это просто рандом
    return (Math.floor(Math.random() * 100) + 1) <= this.config.orderProbability;
}


private async tryToSell(rate:number) {

    const orders:Array<Order> = await this.order.getActiveOrdersAboveProfit(rate, this.config.minDailyProfit, this.config.minYearlyProfit);
    
    for(const order of orders) {
        await this.createCloseOrder(rate, order);
    }
}

private async createBuyOrder(price:number, amount1:number) {
    const extOrder = await this.api.createOrder(this.config.pair, 'market', 'buy', amount1);

    if (extOrder.id != undefined) {                
        // store in db
        const order = await this.order.create({
            extOrderId: extOrder.id,
            expectedRate: price, 
            rate: extOrder.price, 
            amount1: extOrder.amount,
            amount2: extOrder.average
        });
        this.balance.outcome(this.config.currency1, order.amount1);
        this.balance.income(this.config.currency2, order.amount2);

        this.log.info("New order", 
        'Balance 1: ' + await this.balance.getBalanceAmount(this.config.currency1),
        'Balance 2: ' + await this.balance.getBalanceAmount(this.config.currency2),
        // 'Active orders: '+OrderService.getActiveOrdersCount()
        extOrder, 
        order);               
    }
}


private async createCloseOrder(price:number, order:Order) {
    const extOrder = await this.api.createOrder(this.config.pair, 'limit', 'sell', order.amount1, price);

    if (extOrder.id != undefined) {                
        // store in db
        const closeOrder = await this.order.create({
            extOrderId: extOrder.id,
            expectedRate: price, 
            rate: extOrder.price, 
            amount1: extOrder.amount,
            amount2: extOrder.average,
            parentId: order.id,
        });        

        this.log.info("New close order",         
        extOrder, 
        closeOrder);      
    }
}

private async syncData() {
    // тут нужно загрузить в базу текущий баланс и в текущую переменную
     this.balance.set( await this.api.fetchBalances() );
}


}