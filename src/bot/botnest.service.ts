import { Injectable } from "@nestjs/common";
import { ApiService } from "../exchange/api.service";
import { PairService } from "../exchange/pair.service";
import { Order } from "../order/entities/order.entity";
import { StrategyService } from "../strategy/strategy.service";
import { AccountService } from "../user/account.service";
import { ExchangePairRatesDto, RateDto } from "./dto/pair-rates.dto";
import { TradeService } from "./trade.service";
import { OrderService } from "../order/order.service";
import { isSuitableRate, sleep } from "../helpers/helpers";
import { FileLogService } from "../log/filelog.service";
import { BalanceService } from "../balance/balance.service";
import { compareTo, subtract } from "../helpers/bc";
import { ExchangeService } from "../exchange/exchange.service";
import { Exchange } from "../exchange/entities/exchange.entity";
import { BalancesDto } from "../balance/dto/balances.dto";

@Injectable()
export class BotNest {
  lastRates = {};

  constructor(
    public trade: TradeService,
    private accounts: AccountService,
    private pairs: PairService,
    private strategies: StrategyService,
    private orders: OrderService,
    private log: FileLogService,
    private balance: BalanceService,
    private exchange: ExchangeService,
    public apiService: ApiService
  ) {
  }

  public async fetchOrCreateExchange(title: string, test_mode: boolean) {
    return await this.exchange.fetchOrCreate(title, test_mode);
  }

  public async getExchanges() {
    return await this.exchange.getAllActive();
  }

  public async checkBalance(
    accountId: number,
    fullCheck = false
  ): Promise<BalancesDto> {
    const api = await this.getApiForAccount(accountId);

    const exBalances = await this.apiService.fetchBalances(api);
    await this.balance.set(accountId, exBalances);

    if (fullCheck) {
      const balances = await this.balance.getBalances(accountId);

      for (const currency of Object.keys(balances)) {
        const ordersSum = await this.getActiveOrdersSum(
          accountId,
          currency,
          "amount1"
        );

        this.log.info("Check order summ", accountId, currency, ordersSum);

        const balance = await this.balance.getBalance(accountId, currency);
        if (balance) {
          balance.in_orders = ordersSum ?? 0;
          balance.available = subtract(
            subtract(balance.amount, balance.in_orders),
            balance.for_fee
          );
          await this.balance.saveBalance(balance);
        }
      }
    }

    return exBalances;
  }

  public async addStrategy(strategyModel) {
    this.trade.addStrategy(strategyModel);
  }

  async setUserAccount(userId: number, config) {
    const account = await this.accounts.fetchOrCreate(userId);
    return this.accounts.setAccount(account, config);
  }

  async getApiForAccount(accountId: number) {
    return this.accounts.getApiForAccount(accountId);
  }

  async actualizePair(exchange: Exchange, pairName: string) {
    const api = await this.getApiForExchange(exchange);
    return await this.pairs.actualize(api, pairName, exchange.id);
  }

  async setStrategyForAccount(where: object, strategy: any, config: any) {
    return this.strategies.setStrategyForAccount(where, strategy, config);
  }

  async checkLimitOrders(): Promise<Array<Order>> {
    return this.trade.checkLimitOrders();
  }

  public async setRates(rates: ExchangePairRatesDto) {
    for (const [exchangeId, pairRates] of Object.entries(rates)) {
      for (const [pairName, rate] of Object.entries(pairRates)) {
        const pair = await this.pairs.fetchOrCreate(
          Number(exchangeId),
          pairName
        );
        await this.pairs.setInfo(pair, {
          buyRate: (rate as RateDto).bid,
          sellRate: (rate as RateDto).ask
        });
      }
    }
  }

  async runBuyStrategies() {
    return this.trade.runBuyStrategies();
  }

  async runSellStrategies() {
    return this.trade.runSellStrategies();
  }

  public async getActualRates(
    api,
    pairName: string
  ): Promise<{ bid: number; ask: number }> {
    return this.apiService.getActualRates(api, pairName);
  }

  public async getActiveOrdersSum(
    accountId: number,
    currency1: string,
    attribute: string
  ) {
    return this.orders.getActiveOrdersSum(accountId, currency1, attribute);
  }

  public async getApiForExchange(exchange: Exchange) {
    return await this.exchange.getApiForExchange(exchange);
  }

  public async checkRates(
    minBuyRateMarginToProcess: number,
    minSellRateMarginToProcess: number,
    availablePairs: Array<String>
  ): Promise<{
    isBidMargined: boolean;
    isAskMargined: boolean;
    changedPairs: ExchangePairRatesDto;
  }> {
    let isBidMargined = false,
      isAskMargined = false;
    const changedPairs = {};

    const exchanges = await this.exchange.getAllActive();

    for (const exchange of exchanges) {
      if (!this.lastRates[exchange.id]) {
        this.lastRates[exchange.id] = {};
      }
      const api = await this.exchange.getApiForExchange(exchange);

      // this.log.info('checkRates starting for '+exchanges.title+'...');

      for (const pair of exchange.pairs) {
        if (pair.is_trade == false) continue;

        const pairName = pair.name;

        if (!availablePairs.includes(pairName)) continue;

        if (!this.lastRates[exchange.id][pairName]) {
          this.lastRates[exchange.id][pairName] = {
            bid: 0,
            ask: 0
          };
        }
        const lastRates = this.lastRates[exchange.id][pairName];

        try {
          const rates = await this.apiService.getActualRates(api, pairName);

          if (compareTo(rates.bid, rates.ask) > 0) {
            this.log.info(
              `[${exchange.title}] incorrect bid>ask ${rates.bid}>${rates.ask}`,
            );
          }


          const isCurrentBidMargined = isSuitableRate(
            rates.bid,
            lastRates.bid,
            minBuyRateMarginToProcess
          );
          // this.log.info('isCurrentBidMargined', pairName, rates.bid, lastRates.bid, minBuyRateMarginToProcess, isCurrentBidMargined);

          const isCurrentAskMargined = isSuitableRate(
            rates.ask,
            lastRates.ask,
            minSellRateMarginToProcess
          );
          // this.log.info('isCurrentAskMargined', pairName, rates.ask, lastRates.ask, minSellRateMarginToProcess, isCurrentAskMargined);

          if (isCurrentBidMargined) {
            changedPairs[exchange.id] = changedPairs[exchange.id] || {};
            changedPairs[exchange.id][pairName] = rates;

            this.log.info(
              `[${exchange.title}] Rates by ${pairName} bid:`,
              rates.bid
            );
            lastRates.bid = rates.bid;
          }

          if (isCurrentAskMargined) {
            changedPairs[exchange.id] = changedPairs[exchange.id] || {};
            changedPairs[exchange.id][pairName] = rates;

            this.log.info(
              `[${exchange.title}] Rates by ${pairName} ask:`,
              rates.ask
            );
            lastRates.ask = rates.ask;
          }

          isBidMargined = isBidMargined || isCurrentBidMargined;
          isAskMargined = isAskMargined || isCurrentAskMargined;
        } catch (e) {
          this.log.error(
            exchange.title + ": Get rates error (" + pairName + ")",
            e.message,
            e.stack
          );
          await sleep(1);
          // return { isBidMargined, isAskMargined, changedPairs };
          continue;
        }
      }

      // this.log.info('checkRates finished');
    }
    return { isBidMargined, isAskMargined, changedPairs };
  }
}
