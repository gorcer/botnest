import { OrderSide, OrderType } from "ccxt/js/src/base/types";
import binance from "ccxt/js/src/pro/binance";


export class BaseApiService {

    exchange: binance;
    lastTradesFetching;

    public async getActualRates(pair:string) {
        const orderBook = await this.exchange.watchOrderBook(pair, 5);

        if (orderBook.bids[0] == undefined || orderBook.asks[0] == undefined)  {
            console.log('Can`t fetch rates ');
            // console.log(orderBook);
            return false;
        }

        const bid = orderBook.bids[0][0];
        const ask = orderBook.asks[0][0];

        return {bid, ask};
    }


    public async fetchBalances() {

        // console.log( (await this.exchange.fetchMarkets()) );

        const balances = (await this.exchange.fetchBalance ()).info.balances;
        const result = {};
        balances.forEach((item)=>{
            result[item.asset] = item.free;
        });

        return result;
    }

    public async createOrder(symbol:string, side:OrderSide, type:OrderType, amount:number, price?:number) {
        return await this.exchange.createOrder(symbol, side, type, amount, price);
    }

    public async watchTrades(pair: string) {      

        return this.exchange.watchMyTrades(pair);
    }

    public async fetchOrder(orderId:number, symbol: string) {
        return this.exchange.fetchOrder(String(orderId), symbol);
    }

}