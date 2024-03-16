import { Injectable } from '@nestjs/common';
import { OrderSide, OrderType } from 'ccxt/js/src/base/types';
import { numberTrim } from '../../helpers/helpers';
import { Order, OrderSideEnum } from '../../order/entities/order.entity';

@Injectable()
export class DummyExchange {

  test_mode = true;
  
  precision = 8;

  markets = [
    {
      symbol: 'BTC/USDT',
      limits: {
        amount: {
          min: 0.000001,
        },
        cost: {
          min: 10,
        },
      },      
    },
  ];

  rownN = 0;
  data = [];

  orders = [];
  orderbook = [];
  lastOrderId = 0;
  tickers = {};

  priceToPrecision(symbol, value) {
    return this.amountToPrecision(symbol, value);
  }
  amountToPrecision(symbol, value) {
    return numberTrim(value, this.precision);
  }

  setTickers(tickers) {
    this.tickers = tickers;
  }

  fetchTickers() {
    return this.tickers;
  }

  setLastPrice(pair, value) {
    return this.setTicker(pair, {last: value});
  }

  setTicker(pair, value) {
    this.tickers[pair] = value;
  }

  fetchTicker(pair) {
    return this.tickers[pair];
  }

  setNextOrderBook(bid: number, ask: number) {
    this.orderbook.push({
      bids: [[bid]],
      asks: [[ask]],
    });
  }

  fetchOrderBook(pair, limit) {
    const current = this.orderbook.shift();
    if (!current) {
      return {
        bids: [],
        asks: [],
      };
    }
    return current;
  }

  fetchMarkets() {
    return this.markets;
  }

  fetchBalance() {
    return {
      info: {
        balances: [
          {
            asset: 'BTC',
            free: 1000,
          },
          {
            asset: 'USDT',
            free: 1000,
          },
        ],
      },
    };
  }

  setNextOrder(order) {
    order.id = this.lastOrderId++;
    this.orders.push(order);
  }

  createOrder(
    symbol: string,
    side: OrderSideEnum,
    type: OrderType,
    amount: number,
    price?: number,
  ) {
    return this.orders.shift();
  }

  fetchOrder(id, pair): Order {
    return this.orders.shift();
  }

  setSandboxMode(mode) {
    return false;
  }
}
