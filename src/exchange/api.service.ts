import { OrderSide, OrderType } from 'ccxt/js/src/base/types';
import { BalancesDto } from '../balance/dto/balances.dto';
import { pro as ccxt } from 'ccxt';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { Injectable, Inject, ConsoleLogger } from '@nestjs/common';
import { extractCurrency } from '../helpers/helpers';

class MarketInfoDto {
  minAmount: number;
  minCost: number;
  fee: number;
  pricePrecision: number;
  amountPrecision: number;
  basePrecision: number;
  quotePrecision: number;
}

@Injectable()
export class ApiService {
  lastTradesFetching;
  availableCurrencies = [];

  constructor(@Inject(CACHE_MANAGER) private cacheManager: Cache) {
    const pairs = process.env.PAIRS.replace(' ', '').split(',');
    for (const pair of pairs) {
      const { currency1, currency2 } = extractCurrency(pair);
      this.availableCurrencies.push(currency1);
      this.availableCurrencies.push(currency2);
    }
  }

  public async getApi(
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

    await api.loadMarkets();

    return api;
  }

  public async getActualRates(
    api,
    pair: string,
  ): Promise<{ bid: number; ask: number }> {
    const orderBook = await api.fetchOrderBook(pair, 5);

    if (orderBook.bids[0] == undefined || orderBook.asks[0] == undefined) {
      throw new Error('Can`t fetch rates for pair ' + pair);
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

      const {
        amount: amountPrecision,
        price: pricePrecision,
        base: basePrecision,
        quote: quotePrecision,
      } = markets[0].precision;
      const { amount, cost } = markets[0].limits;
      const { taker, maker } = markets[0];

      value = {
        amountPrecision,
        pricePrecision,
        basePrecision,
        quotePrecision,
        minAmount: amount?.min,
        minCost: cost?.min,
        fee: Math.max(taker, maker),
      };

      await this.cacheManager.set(key, value, 60 * 60 * 1000);
    }

    return value;
  }

  public async fetchBalances(api): Promise<BalancesDto> {
    // const markets = (await this.exchange.fetchMarkets()).filter((item) => item.id == 'ETHUSDT');
    // console.log(markets[0].limits, markets[0]);

    const response = await api.fetchBalance();

    const result = {};
    for (const [currency, value] of Object.entries(response.free)) {
      if (this.availableCurrencies.includes(currency)) {
        result[currency] = api.currencyToPrecision(currency, value);
      }
    }

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

    let order = await api.createOrder(
      symbol,
      type,
      side,
      api.amountToPrecision(symbol, amount),      
      api.priceToPrecision(symbol, price),
    );

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

  public async fetchOrder(api, orderId: string, symbol: string) {
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
