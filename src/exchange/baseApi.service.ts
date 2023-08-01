import { OrderSide, OrderType } from "ccxt/js/src/base/types";
import { BalancesDto } from "../balance/dto/balances.dto";
import ccxt from "ccxt";


export class BaseApiService {

    exchange;
    lastTradesFetching;


    public async getActualRates(pair:string) {
        const orderBook = await this.exchange.fetchOrderBook(pair, 5);

        if (orderBook.bids[0] == undefined || orderBook.asks[0] == undefined)  {
            console.log('Can`t fetch rates ');
            // console.log(orderBook);
            return false;
        }

        const bid = orderBook.bids[0][0];
        const ask = orderBook.asks[0][0];

        return {bid, ask};
    }

    public async getLimits(pair: string) {
        const markets = (await this.exchange.fetchMarkets()).filter((item) => item.symbol == pair);
        const {amount, cost} = markets[0].limits;

        return {minAmount:amount.min, minCost:cost.min};

    }

    public async fetchBalances():Promise<BalancesDto> {

        // const markets = (await this.exchange.fetchMarkets()).filter((item) => item.id == 'ETHUSDT');
        // console.log(markets[0].limits, markets[0]);
        

        const balances = (await this.exchange.fetchBalance()).info.balances;
        const result = {};
        balances.forEach((item)=>{
            result[item.asset] = item.free;
        });

        return result;
    }

    public async createOrder(symbol:string, type:OrderType,side:OrderSide, amount:number, price?:number) {
        return await this.exchange.createOrder(symbol, type, side, amount, price);
    }

    public async watchTrades(pair: string) {      

        return this.exchange.watchMyTrades(pair);
    }

    public async fetchOrder(orderId:number, symbol: string) {
        return this.exchange.fetchOrder(String(orderId), symbol);
    }

    public async fetchTickers() {
        return this.exchange.fetchTickers();
    }

}