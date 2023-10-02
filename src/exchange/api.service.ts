import { OrderSide, OrderType } from 'ccxt/js/src/base/types';
import { BalancesDto } from '../balance/dto/balances.dto';
import { pro as ccxt } from 'ccxt';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { Injectable, Inject } from '@nestjs/common';

@Injectable()
export class ApiService {
  lastTradesFetching;
  markets = {};

  constructor(@Inject(CACHE_MANAGER) private cacheManager: Cache) {}

  public getApi(exchangeClass, apiKey = '', secret = '', sandBoxMode = true) {
    if (typeof exchangeClass == 'string') {
      exchangeClass = ccxt[exchangeClass];
    }

    const api = new exchangeClass({
      apiKey,
      secret,
    });
    api.setSandboxMode(sandBoxMode);

    return api;
  }

  public async getActualRates(
    api,
    pair: string,
  ): Promise<{ bid: number; ask: number }> {
    const orderBook = await api.fetchOrderBook(pair, 5);

    if (orderBook.bids[0] == undefined || orderBook.asks[0] == undefined) {
      throw new Error('Can`t fetch rates');
    }

    const bid = orderBook.bids[0][0];
    const ask = orderBook.asks[0][0];

    return { bid, ask };
  }

  public async getMarketInfo(
    api,
    pair: string,
  ): Promise<{ minAmount: number; minCost: number; fee: number }> {
    if (this.markets[pair]) {
      return this.markets[pair];
    }
    const allMarkets = await api.fetchMarkets();
    const markets = allMarkets.filter((item) => item.symbol == pair);

    if (markets.length == 0) return null;

    const { amount, cost } = markets[0].limits;
    const { taker, maker } = markets[0];

    this.markets[pair] = {
      minAmount: amount.min,
      minCost: cost.min,
      fee: Math.max(taker, maker),
    };
    return this.markets[pair];
  }

  public async fetchBalances(api): Promise<BalancesDto> {
    // const markets = (await this.exchange.fetchMarkets()).filter((item) => item.id == 'ETHUSDT');
    // console.log(markets[0].limits, markets[0]);

    const balances = (await api.fetchBalance()).info.balances;
    const result = {};
    balances.forEach((item) => {
      result[item.asset] = item.free;
    });

    return result;
  }

  public async createOrder(
    api,
    symbol: string,
    type: OrderType,
    side: OrderSide,
    amount: number,
    price?: number,
  ) {
    return await api.createOrder(symbol, type, side, amount, price);
  }

  public async watchTrades(api, pair: string) {
    return api.watchMyTrades(pair);
  }

  public async fetchOrder(api, orderId: number, symbol: string) {
    return api.fetchOrder(String(orderId), symbol);
  }

  public async fetchTickers(api) {
    return api.fetchTickers();
  }

  public async fetchTrades(api, pair, since) {
    return api.fetchTrades(pair, since);
  }

  async getLastPrice(api, pair: string) {
    const key = api.id + '.lastPrice.' + pair;
    let value = await this.cacheManager.get(key);
    if (!value) {
      const tickers = await api.fetchTickers();
      value = tickers[pair].last;
      await this.cacheManager.set(key, value, 10);
    }

    return value;
  }
}
