import { OrderSide, OrderType } from 'ccxt/js/src/base/types';
import { BalancesDto } from '../balance/dto/balances.dto';
import { pro as ccxt } from 'ccxt';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { Injectable, Inject } from '@nestjs/common';

class MarketInfoDto {
  minAmount: number;
  minCost: number;
  fee: number;
  pricePrecision: number;
  amountPrecision: number;
}

@Injectable()
export class ApiService {
  lastTradesFetching;

  constructor(@Inject(CACHE_MANAGER) private cacheManager: Cache) {}

  public getApi(
    exchangeClass,
    apiKey = '',
    secret = '',
    password = '',
    sandBoxMode = true,
  ) {
    if (typeof exchangeClass == 'string') {
      exchangeClass = ccxt[exchangeClass];
    }

    const api = new exchangeClass({
      apiKey,
      secret,
      password,
      options: { defaultType: 'spot' },
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

  public async getMarketInfo(api, pair: string): Promise<MarketInfoDto> {
    const key = api.exchange_id + '.market.' + pair;
    let value: MarketInfoDto = await this.cacheManager.get(key);

    if (!value) {
      const allMarkets = await api.fetchMarkets();
      const markets = allMarkets.filter((item) => item.symbol == pair);

      if (markets.length == 0) return null;

      const { amount: amountPrecision, price: pricePrecision } =
        markets[0].precision;
      const { amount, cost } = markets[0].limits;
      const { taker, maker } = markets[0];

      value = {
        amountPrecision,
        pricePrecision,
        minAmount: amount?.min,
        minCost: cost?.min,
        fee: Math.max(taker, maker),
      };

      await this.cacheManager.set(key, value, 1000);
    }

    return value;
  }

  public async fetchBalances(api): Promise<BalancesDto> {
    // const markets = (await this.exchange.fetchMarkets()).filter((item) => item.id == 'ETHUSDT');
    // console.log(markets[0].limits, markets[0]);

    const response = await api.fetchBalance();
    const balances = response.info.balances;
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
    let order = await api.createOrder(symbol, type, side, amount, price);

    if (typeof order.amount == 'undefined') {
      order = await this.fetchOrder(api, order.id, symbol);
    }

    return order;
  }

  // public async watchTrades(api, pair: string) {
  //   return api.watchMyTrades(pair);
  // }

  public async fetchOrders(api, symbol: string) {
    return api.fetchOrders(symbol);
  }

  public async fetchOrder(api, orderId: number, symbol: string) {
    return api.fetchOrder(String(orderId), symbol);
  }

  public async fetchTrades(api, pair, since) {
    return api.fetchTrades(pair, since);
  }

  async getLastPrice(api, pair: string) {
    const key = api.exchange_id + '.lastPrice.' + pair;
    let value = await this.cacheManager.get(key);
    if (!value) {
      const ticker = await api.fetchTicker(pair);
      value = ticker.last;
      await this.cacheManager.set(key, value, 1000);
    }

    return value;
  }
}
