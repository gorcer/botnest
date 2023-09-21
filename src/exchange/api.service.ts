import { OrderSide, OrderType } from 'ccxt/js/src/base/types';
import { BalancesDto } from '../balance/dto/balances.dto';
import { OrderSideEnum } from '../order/entities/order.entity';
import { pro as ccxt } from 'ccxt';

export class ApiService {
  exchange;
  lastTradesFetching;
  markets = {};

  constructor(exchangeClass, apiKey = '', secret = '', sandBoxMode = true) {
    if (typeof exchangeClass == 'string') {
      exchangeClass = ccxt[exchangeClass];
    }

    this.exchange = new exchangeClass({
      apiKey,
      secret,
    });
    this.exchange.setSandboxMode(sandBoxMode);
  }

  public async getActualRates(
    pair: string,
  ): Promise<{ bid: number; ask: number }> {
    const orderBook = await this.exchange.fetchOrderBook(pair, 5);

    if (orderBook.bids[0] == undefined || orderBook.asks[0] == undefined) {
      throw new Error('Can`t fetch rates');
    }

    const bid = orderBook.bids[0][0];
    const ask = orderBook.asks[0][0];

    return { bid, ask };
  }

  public async getMarketInfo(
    pair: string,
  ): Promise<{ minAmount: number; minCost: number; fee: number }> {
    if (this.markets[pair]) {
      return this.markets[pair];
    }

    const markets = (await this.exchange.fetchMarkets()).filter(
      (item) => item.symbol == pair,
    );
    const { amount, cost } = markets[0].limits;
    const { taker, maker } = markets[0];

    this.markets[pair] = {
      minAmount: amount.min,
      minCost: cost.min,
      fee: Math.max(taker, maker),
    };
    return this.markets[pair];
  }

  public async fetchBalances(): Promise<BalancesDto> {
    // const markets = (await this.exchange.fetchMarkets()).filter((item) => item.id == 'ETHUSDT');
    // console.log(markets[0].limits, markets[0]);

    const balances = (await this.exchange.fetchBalance()).info.balances;
    const result = {};
    balances.forEach((item) => {
      result[item.asset] = item.free;
    });

    return result;
  }

  public async createOrder(
    symbol: string,
    type: OrderType,
    side: OrderSide,
    amount: number,
    price?: number,
  ) {
    return await this.exchange.createOrder(symbol, type, side, amount, price);
  }

  public async watchTrades(pair: string) {
    return this.exchange.watchMyTrades(pair);
  }

  public async fetchOrder(orderId: number, symbol: string) {
    return this.exchange.fetchOrder(String(orderId), symbol);
  }

  public async fetchTickers() {
    return this.exchange.fetchTickers();
  }

  public async fetchTrades(pair, since) {
    return this.exchange.fetchTrades(pair, since);
  }

  async getLastPrice(pair) {
    const tickers = await this.fetchTickers();
    return tickers[pair].last;
  }
}
