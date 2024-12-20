import { FileLogService } from "../log/filelog.service";
import { elapsedSecondsFrom, extractCurrency, SEC_IN_HOUR, sleep } from "../helpers/helpers";
import { BalanceService } from "../balance/balance.service";
import { ApiService } from "../exchange/api.service";
import { FillCellsStrategy } from "../strategy/buyFillCellsStrategy/fillCellsStrategy.strategy";
import { Account } from "../user/entities/account.entity";
import { AwaitProfitStrategy } from "../strategy/sellAwaitProfitStrategy/awaitProfitStrategy.strategy";
import { BotNest } from "../bot/botnest.service";
import { Injectable } from "@nestjs/common";
import { multiply, subtract } from "../helpers/bc";

@Injectable()
export class DaemonTradeService {
  account: Account;
  minBuyRateMarginToProcess;
  minSellRateMarginToProcess;
  pairs: Array<string>;
  accountConfig;
  api;

  constructor(
    private log: FileLogService,
    private balance: BalanceService,
    private botnest: BotNest,
    private apiService: ApiService
  ) {
  }

  async trade() {
    let lastStatUpdate = 0,
      lastTradesUpdate = Date.now() / 1000;

    await this.init();

    while (true) {
      try {
        // Проверяем есть ли значимое изменение курса
        const { isBidMargined, isAskMargined, changedPairs } =
          await this.botnest.checkRates(
            this.minBuyRateMarginToProcess,
            this.minSellRateMarginToProcess,
            this.pairs
          );

        // Если есть, то отправляем курс боту
        if (isBidMargined || isAskMargined) {
          await this.botnest.setRates(changedPairs);
        }

        const promises = [];
        // Запускаем стратегии покупки
        if (isBidMargined) {
          promises.push(this.botnest.runBuyStrategies());
          // const orders = await this.tryToBuy();
          // if (orders.length > 0) {
          // 	await this.checkCloseOrders();
          // }
        }

        // Запускаем стратегии продажи
        if (isAskMargined) {
          promises.push(this.botnest.runSellStrategies());
          // await this.tryToSellAllSuitableOrders();
        }

        if (promises.length > 0) {
          await Promise.all(promises);
        }

        if (elapsedSecondsFrom(SEC_IN_HOUR, lastStatUpdate)) {
          await this.saveStat(this.account.id, this.pairs);
          lastStatUpdate = Date.now() / 1000;
        }

        if (elapsedSecondsFrom(SEC_IN_HOUR / 4, lastTradesUpdate)) {
          await this.checkCloseOrders();
          lastTradesUpdate = Date.now() / 1000;
        }

        // for (const pairName of this.pairs) {
        // 	this.api.watchTrades(pairName).then((items => {
        // 		this.log.info('Watch trade', items[0]?.info?.id);
        // 	}));
        // }
      } catch (e) {
        this.log.error("Trade error...wait 60 sec", e.message, e.stack);
        await sleep(60);
      }
    }
  }

  private async init() {
    this.minBuyRateMarginToProcess = process.env.DAEMON_MIN_BUY_RATE_MARGIN;
    this.minSellRateMarginToProcess = process.env.DAEMON_MIN_SELL_RATE_MARGIN;

    const exchange = await this.botnest.fetchOrCreateExchange(
      process.env.EXCHANGE_NAME,
      process.env.TEST_MODE == "true"
    );

    this.pairs = process.env.PAIRS.replace(" ", "").split(",");

    this.botnest.addStrategy(FillCellsStrategy);
    this.botnest.addStrategy(AwaitProfitStrategy);

    this.account = await this.botnest.setUserAccount(1, {
      apiKey: process.env.EXCHANGE_API_KEY,
      secret: process.env.EXCHANGE_API_SECRET,
      password: process.env.EXCHANGE_API_PASSWORD,
      exchange
    });
    this.api = await this.botnest.getApiForAccount(this.account.id);

    // тут нужно загрузить в базу текущий баланс и в текущую переменную
    // await this.balance.loadBalances(this.account.id);
    await this.checkBalance();

    // актуализируем пары и стратегии
    for (const pairName of this.pairs) {
      const pair = await this.botnest.actualizePair(exchange, pairName);

      const { currency2 } = extractCurrency(pairName);
      // const balance1 = await this.balance.getBalance(
      //   this.account.id,
      //   currency1,
      // );
      const balance2 = await this.balance.getBalance(
        this.account.id,
        currency2
      );

      const totalBalance = balance2.amount;

      await this.botnest.setStrategyForAccount(
        {
          accountId: this.account.id,
          pairId: pair.id
        },
        FillCellsStrategy,
        {
          orderAmount: Number(process.env.STRATEGY_BUY_ORDER_AMOUNT),
          risk: process.env.STRATEGY_BUY_RISK,
          pairId: pair.id,
          cellSize: FillCellsStrategy.calculateCellSize({
            totalBalance,
            pair,
            orderAmount: Number(process.env.STRATEGY_BUY_ORDER_AMOUNT),
            minRate: pair.historicalMinRate
          })
        }
      );
    }

    await this.botnest.setStrategyForAccount(
      {
        accountId: this.account.id
      },
      AwaitProfitStrategy,
      {
        minDailyProfit: Number(process.env.STRATEGY_SELL_MIN_DAILY_PROFIT), // % годовых если сделка закрывается за день
        minYearlyProfit: Number(process.env.STRATEGY_SELL_MIN_ANNUAL_PROFIT) // % годовых если сделка живет больше дня
      }
    );

    // проверить состояние открытых ордеров
    await this.checkCloseOrders();
  }

  private async checkCloseOrders() {
    const closedOrders = await this.botnest.checkLimitOrders();
    if (closedOrders.length > 0) {
      await this.checkBalance();
    }
  }

  private async checkBalance() {
    await this.balance.set(
      this.account.id,
      await this.apiService.fetchBalances(this.api)
    );

    for (const pairName of this.pairs) {
      const { currency1 } = extractCurrency(pairName);
      const ordersSum = await this.botnest.getActiveOrdersSum(
        this.account.id,
        currency1,
        "amount1"
      );

      const balance = await this.balance.getBalance(this.account.id, currency1);
      if (balance) {
        balance.in_orders = ordersSum ?? 0;
        balance.available = subtract(balance.amount, balance.in_orders);
        await this.balance.saveBalance(balance);
      }
    }
  }

  private async saveStat(accountId: number, pairs: Array<string>) {
    for (const pair of pairs) {
      const { currency1, currency2 } = extractCurrency(pair);
      const balance1 = await this.balance.getBalanceAmount(
        accountId,
        currency1
      );
      const balance2 = await this.balance.getBalanceAmount(
        accountId,
        currency2
      );
      const rate = await this.apiService.getLastPrice(this.api, pair);

      this.log.stat(
        currency1,
        balance1,
        currency2,
        balance2,
        "Total in " + currency2,
        multiply(rate, balance1)
      );
    }
  }
}
