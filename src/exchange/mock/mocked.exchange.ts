import { Injectable } from '@nestjs/common';
import { OrderSide, OrderType } from 'ccxt/js/src/base/types';
import { Order, OrderSideEnum } from '../../order/entities/order.entity';
const {
  divide,
  subtract,
  multiply,
  compareTo,
  add,
} = require('js-big-decimal');

@Injectable()
export class MockedExchange {
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

  rowN = 0;
  data = [];

  orders = [];
  orderbook = [];
  lastOrderId = 0;
  tickers = {};

  setTickers(tickers) {
    this.tickers = tickers;
  }

  fetchTickers() {
    return this.tickers;
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

  createOrder(
    symbol: string,
    side: OrderSideEnum,
    type: OrderType,
    amount: number,
    price?: number,
  ) {
    this.lastOrderId++;

    this.orders[this.lastOrderId] = {
      price: price,
      amount: amount,
      cost: multiply(price, amount),
      fees: [
        {
          cost: 0,
          currency: 'USDT',
        },
      ],
    };

    return this.orders.shift();
  }

  fetchOrder(id, pair): Order {
    return this.orders.shift();
  }

  setSandboxMode(mode) {}
}
