import { Inject, Injectable } from '@nestjs/common';
import { BotNest } from './bot/botnest.service';
import { FillCellsStrategy } from './strategy/buyFillCellsStrategy/fillCellsStrategy.strategy';
import { AwaitProfitStrategy } from './strategy/sellAwaitProfitStrategy/awaitProfitStrategy.strategy';
import {
  SEC_IN_HOUR,
  elapsedSecondsFrom,
  sleep,
  lock,
} from './helpers/helpers';
import { FileLogService } from './log/filelog.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { FillCellsStrategyService } from './strategy/buyFillCellsStrategy/fillCellsStrategy.service';
import * as _ from 'lodash';

@Injectable()
export class DaemonService {
  minBuyRateMarginToProcess;
  minSellRateMarginToProcess;
  pairs: Array<string>;

  constructor(
    private botnest: BotNest,
    private log: FileLogService,
    private eventEmitter: EventEmitter2,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    private fillCellsService: FillCellsStrategyService,
  ) {
    this.checkBalance = this.checkBalance.bind(this);
    this.recalcCellSize = this.recalcCellSize.bind(this);

    // не нужно каждый раз чекать баланс, так как между closeOrder and checkCloseOrder может случиться актуализация, потом check сломает баланс и выравнится баланс только после следующего заказа
    // this.eventEmitter.on('buyOrder.created', this.checkBalance);
    // this.eventEmitter.on('sellOrder.created', this.checkBalance);
    this.eventEmitter.on('buyOrder.created', this.recalcCellSize);
  }

  async checkBalance({ accountId }) {
    try {
      await lock.acquire('Balance ' + accountId, async () => {
        this.log.info('Check balance begin ....');
        await this.botnest.checkBalance(accountId);
        this.log.info('Check balance Ok');
      });
    } catch (e) {
      this.log.error('Check balance error...', e.message, e.stack);
    }
  }

  async recalcCellSize({ orderInfo }) {
    const { accountId } = orderInfo;
    const key = accountId + '.recalcCellSize';
    const isChecked: boolean = await this.cacheManager.get(key);
    if (isChecked) return;
    

    try {
      if (accountId) {
        await this.fillCellsService.recalcCellSize(accountId);
      }
    } catch (e) {
      this.log.error('recalcCellSize error...', e.message, e.stack);
    }

    await this.cacheManager.set(key, true, 10 * 60 * 1000);
  }

  public async init() {
    // await this.recalcCellSize({ strategyableId: 3 });
    this.minBuyRateMarginToProcess = process.env.DAEMON_MIN_BUY_RATE_MARGIN;
    this.minSellRateMarginToProcess = process.env.DAEMON_MIN_SELL_RATE_MARGIN;
    this.pairs = process.env.PAIRS.replace(' ', '').split(',');

    this.botnest.addStrategy(FillCellsStrategy);
    this.botnest.addStrategy(AwaitProfitStrategy);

    this.log.info('Actualize pairs ...');

    const exchanges = await this.botnest.getExchanges();
    for (const exchange of exchanges) {
      for (const pairName of this.pairs) {
        try {
          await this.botnest.actualizePair(exchange, pairName);
        } catch (e) {
          this.log.error('Actualize pairs error ', e.message);
        }
      }
    }
    this.log.info('Ok');

    this.log.info('Check close orders ...');
    await this.botnest.checkCloseOrders();
    this.log.info('Ok');

    // await this.botnest.checkBalance(2);
  }

  async trade() {
    let lastTradesUpdate = Date.now() / 1000;

    while (true) {
      try {
        const promises = [];

        const { isBidMargined, isAskMargined, changedPairs } =
          await this.botnest.checkRates(
            this.minBuyRateMarginToProcess,
            this.minSellRateMarginToProcess,
            this.pairs,
          );

        if (isBidMargined || isAskMargined) {
          await this.botnest.setRates(changedPairs);
        }

        if (isBidMargined) {
          promises.push(this.botnest.runBuyStrategies());
        }

        if (isAskMargined) {
          promises.push(this.botnest.runSellStrategies());
        }

        if (elapsedSecondsFrom(SEC_IN_HOUR / 4, lastTradesUpdate)) {
          promises.push(
            this.botnest.checkCloseOrders().then((orders) => {
              if (orders.length > 0) {
                const accountIds = _.uniq(_.map(orders, 'accountId'));
                accountIds.forEach(async (accountId) => {
                  await this.checkBalance({ accountId });
                });
              }
            }),
          );
          lastTradesUpdate = Date.now() / 1000;
        }

        if (promises.length > 0) {
          await Promise.all(promises);
        } else {
          sleep(5);
        }

      } catch (e) {
        this.log.error('Trade error...wait 10 sec', e.message, e.stack);
        await sleep(10);
      }
    }
  }
}
