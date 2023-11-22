import { Injectable } from '@nestjs/common';
import { readFileSync, writeFileSync } from 'fs';

@Injectable()
export class TradeCheckService {
  path = `./_log/check.csv`;
  orders: {
    extOrder: object;
    orderInfo: object;
  } | {};

  constructor() {
    try {
      this.orders = JSON.parse(readFileSync(this.path, 'utf8'));
    } catch (e) {
      this.orders = {};
    }
  }

  open(extId: number, data) {
    this.orders[extId] = data;
    this.save();
  }

  close(extId: number) {
    if (this.orders[extId]) {
      delete this.orders[extId];
      this.save();
    }
  }

  save() {
    const message = JSON.stringify(this.orders);

    return writeFileSync(this.path, message, { flag: 'w' });
  }

  checkAndClear() {
    for (const order of Object.values(this.orders)) {
      // if (Date.now() - order.extOrder.timestamp > 60 * 1000) {

      // }
    }
  }
}
