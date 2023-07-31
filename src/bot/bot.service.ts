import { Inject, Injectable } from "@nestjs/common";
import { BaseApiService } from "../exchange/baseApi.service";
import { BalanceService } from "../balance/balance.service";
import { OrderService } from "../order/order.service";
import { LogService } from "../log.service";
import { Order, OrderType } from "../order/entities/order.entity";
import { UpdateOrderDto } from "../order/dto/update-order.dto";
import { lock, sleep } from "../helpers";

const { divide, subtract, multiply, compareTo, add } = require("js-big-decimal");


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
        minRateMarginToProcess: number,
        sellFee:number
    };

    private touchedOrders={};
    private minAmount:number;
    private minCost:number;
    

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
        minRateMarginToProcess: Number(process.env.BOT_MIN_RATE_MARGIN), // минимальное движение курса для проверки х100=%
        sellFee:  Number(process.env.BOT_SELL_FEE)
    }
}


async trade() {

    let lastAsk:number=1, lastBid:number=1;

    await this.syncData();    

    while(true) {     

        try {
            await this.watchTrades();
        
        
            const ratesInfo = await this.api.getActualRates(this.config.pair);         
            if (!ratesInfo) {
                continue;
            }
            const {bid: rateBid, ask: rateAsk}  = ratesInfo;
          


            if (this.isSuitableRate(rateAsk, lastAsk)) {
                console.log('Rate ask: ', rateAsk);                               
                await this.tryToBuy(rateAsk);
                lastAsk = rateAsk;
            }
            
            if (this.isSuitableRate(rateBid, lastBid)) {
                console.log('Rate bid: ',rateBid);
                await this.tryToSell(rateBid);
                lastBid = rateBid;
            }

            if (
                !this.isSuitableRate(rateBid, lastBid) && 
                !this.isSuitableRate(rateAsk, lastAsk)) {
                    await sleep(1);
            }

        } catch (e) {
            this.log.error('trade error', e);
            this.log.info('Wait 10 sec....');
            await sleep(10);
        }
    }
}

private isSuitableRate(rate:number, lastRate:number) {
    const margin = divide(Math.abs(lastRate - rate) , lastRate, 15);
    return compareTo(margin, this.config.minRateMarginToProcess)>0;
}


private async watchTrades() {
    

    // actualize orders
    this.api.watchTrades(this.config.pair).then(async trades => {
        
        for (const trade of trades) {

            // this.log.info('New Trade', trade.order, trade.side, trade.amount);

            if (trade.side == 'buy') 
                continue;

            this.touchedOrders[trade.order] = true;                
        }

    });
    if (Object.values(this.touchedOrders).length>0)  {
        for(const extOrderId of Object.keys(this.touchedOrders)) {                
            const order = await this.order.findOne({extOrderId});
            await this.checkCloseOrder(order);
            delete this.touchedOrders[extOrderId];
        }
    }
}

private async checkCloseOrder(order: Order){
    
    await lock.acquire('Balance', async ()=>{

        this.log.info('Check order', order.extOrderId);

        if (!order.isActive || order.type != OrderType.SELL)
        return;
    
        const extOrder = await this.api.fetchOrder(Number(order.extOrderId), this.config.pair);
        if (compareTo(extOrder.filled, extOrder.amount) == 0 ) {
    
            await this.balance.income(this.config.currency2, order.amount2);
    
            await this.order.update(order.id, { isActive: false, filled: extOrder.filled });                                      
       
    
            if (order.type == OrderType.SELL) {
                const parentOrder = await this.order.findOne({id: order.parentId});
                const updateOrderDto:UpdateOrderDto = {
                    filled: add(parentOrder.filled, extOrder.filled)
                };        
                if (compareTo(parentOrder.amount1, updateOrderDto.filled) == 0) {
    
                    const totalAmount2 = await this.order.getSumByParentId( parentOrder.id, 'amount2');
                    updateOrderDto.isActive = false;
                    updateOrderDto.profit = subtract(totalAmount2, parentOrder.amount2);
    
                }
                
                await this.order.update(parentOrder.id, updateOrderDto);
                this.log.info('Close order ', parentOrder.extOrderId, 'Profit: ', updateOrderDto.profit);
            }
        }


    });

   
}

private async tryToBuy(rate:number) {
    
    const amount1:number = this.checkLimits(rate, this.config.orderAmount);
    const amount2:number = multiply(rate, amount1);
    const balance2:number = await this.balance.getBalanceAmount(this.config.currency2);

    if (compareTo(balance2, amount2) > 0) {

            await this.createBuyOrder(rate, amount1);
            await this.balance.set( await this.api.fetchBalances() );
            return true;
        } else {
            this.log.info('Cant buy, needs '+amount2 + ' but have only ' + balance2);
            return false;
        }
}


/**
 * 
 * @param price Fix amount to limits
 * @param amount1 
 * @returns 
 */
private checkLimits(price:number, amount1:number) {
    if (compareTo(amount1, this.minAmount)<0)
        amount1=this.minAmount;

    const amount2 = multiply(price, amount1);
    if (compareTo(amount2, this.minCost)<0) {
        amount1=divide(this.minCost+0.1, price, 15);        
    }

    return amount1;
}

private canBuy() {
    // Пока это просто рандом
    return (Math.floor(Math.random() * 100) + 1) <= this.config.orderProbability;
}


private async tryToSell(rate:number) {


    const rateWithSellFee = multiply(rate, (1-this.config.sellFee));
    
    this.log.info('Get active orders....');
    const tm = Date.now();
    const orders:Array<Order> = await this.order.getActiveOrdersAboveProfit(rateWithSellFee, this.config.minDailyProfit, this.config.minYearlyProfit);
    
    this.log.info('Ok...'+orders.length + ' orders ..'+( (Date.now() - tm) / 1000 ) +' sec');


    for(const order of orders) {
        await this.createCloseOrder(rate, order);
    }

    if (orders.length>0) {
        await this.balance.set( await this.api.fetchBalances() );
    }
}

public async createBuyOrder(price:number, amount1:number) {

    return await lock.acquire('Balance', async ()=>{
        console.log('Try to buy', price, amount1, multiply(amount1, price));

        const extOrder = await this.api.createOrder(this.config.pair, 'market', 'buy', amount1);
        

        if (extOrder.id != undefined) {      
            
            let feeCost = extOrder.fee.cost ?? 0;
            
            // store in db
            const order = await this.order.create({
                extOrderId: extOrder.id,
                expectedRate: price, 
                rate: extOrder.price, 
                amount1: extOrder.amount,
                amount2: add(extOrder.cost, feeCost) 
            });
            
            await this.balance.income(this.config.currency1, extOrder.amount);   
            await this.balance.outcome(this.config.currency2, extOrder.cost);   

            this.log.info(
            "New order", 
            order.extOrderId,
            // 'Balance 1: ' + await this.balance.getBalanceAmount(this.config.currency1),
            // 'Balance 2: ' + await this.balance.getBalanceAmount(this.config.currency2),
            // 'Active orders: '+OrderService.getActiveOrdersCount()
            // extOrder, 
            // order
            );               

            return {extOrder, order};
        }
        return false;
    });

    
    
}


private async createCloseOrder(price:number, order:Order) {
    
    let closeOrder:Order;

    await lock.acquire('Balance', async ()=>{
    
        const extOrder = await this.api.createOrder(this.config.pair, 'limit', 'sell', subtract(order.amount1, order.prefilled), price);

        if (extOrder.id != undefined) {                
            // store in db
            closeOrder = await this.order.create({
                extOrderId: extOrder.id,
                expectedRate: price, 
                rate: extOrder.price, 
                amount1: extOrder.amount,
                amount2: multiply(extOrder.amount, extOrder.price),
                parentId: order.id,
                type: OrderType.SELL
            });        

            await this.balance.outcome(this.config.currency1, closeOrder.amount1);        

            await this.order.update(order.id, {prefilled: add(order.prefilled, extOrder.amount)})

            this.log.info("New close order",   closeOrder.extOrderId,      
            // extOrder, 
            // closeOrder
            );     
        } 
    });

    // Сразу проверяем
    if (closeOrder) {
        this.touchedOrders[closeOrder.extOrderId]=true;
    }
}

async syncData() {

    this.log.info('Sync data ....');

    ({ minAmount: this.minAmount, minCost: this.minCost } = await this.api.getLimits(this.config.pair));

    // тут нужно загрузить в базу текущий баланс и в текущую переменную
     await this.balance.set( await this.api.fetchBalances() );

     // проверить состояние открытых ордеров
     const orders = await this.order.findAll({isActive: true, type: OrderType.SELL});
     for(const order of orders) {
        await this.checkCloseOrder(order);
     }

     this.log.info('Ok');
}


}