import binance from "ccxt/js/src/pro/binance";


export class BaseApiService {

    exchange: binance;

    public async getActualRates(pair:string) {
        const orderBook = await this.exchange.watchOrderBook(pair, 5);
        const bid = orderBook.bids[0][0];
        const ask = orderBook.asks[0][0];

        return {bid, ask};
    }

}