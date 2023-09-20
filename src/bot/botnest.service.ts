import { Injectable } from '@nestjs/common';
import { ApiService } from '../exchange/api.service';
import { PairService } from '../exchange/pair.service';
import { PublicApiService } from '../exchange/publicApi.service';
import { Order } from '../order/entities/order.entity';
import { StrategyService } from '../strategy/strategy.service';
import { AccountService } from '../user/account.service';
import { ExchangePairRatesDto, RateDto } from './dto/pair-rates.dto';
import { TradeService } from './trade.service';
import { OrderService } from '../order/order.service';
import { isSuitableRate } from '../helpers/helpers';
import { FileLogService } from '../log/filelog.service';
import { BalanceService } from '../balance/balance.service';
import { subtract } from '../helpers/bc';
import { ExchangeService } from '../exchange/exchange.service';
import { Exchange } from '../exchange/entities/exchange.entity';


@Injectable()
export class BotNest {
  lastRates = {};
  publicApi: PublicApiService;

  constructor(
    public trade: TradeService,
    private accounts: AccountService,
    private pairs: PairService,
    private strategies: StrategyService,
    private orders: OrderService,
    private log: FileLogService,
    private balance: BalanceService,
    private exchange: ExchangeService,
  ) { }

  public async fetchOrCreateExchange(alias: string, test_mode: boolean) {
    return await this.exchange.fetchOrCreate(alias, test_mode);
  }

  public async getExchanges() {
    return await this.exchange.getAllActive();
  }

  public async checkBalance(accountId: number) {
    const api = await this.getApiForAccount(accountId);

    await this.balance.set(accountId, await api.fetchBalances());

    const balances = await this.balance.loadBalances(accountId);

    for (const currency of Object.keys(balances)) {
      const ordersSum = await this.getActiveOrdersSum(
        accountId,
        currency,
        'amount1',
      );

      const balance = await this.balance.getBalance(accountId, currency);
      if (balance) {
        balance.inOrders = ordersSum ?? 0;
        balance.available = subtract(balance.amount, balance.inOrders);
        await this.balance.saveBalance(balance);
      }
    }
  }

  public async addStrategy(strategyModel) {
    this.trade.addStrategy(strategyModel);
  }

  async setUserAccount(userId: number, config) {
    const account = await this.accounts.fetchOrCreate(userId);
    return this.accounts.setAccount(account, config);
  }

  async getApiForAccount(accountId: number): Promise<ApiService> {
    return this.accounts.getApiForAccount(accountId);
  }

  async actualizePair(exchange: Exchange, pairName: string) {
    const pair = await this.pairs.fetchOrCreate(exchange.id, pairName);
    const api = this.getApiForExchange(exchange);
    await this.pairs.actualize(api, pair);
    return pair;
  }

  async setStrategyForAccount(where: object, strategy: any, config: any) {
    return this.strategies.setStrategyForAccount(where, strategy, config);
  }

  async checkCloseOrders(): Promise<Array<Order>> {
    return this.trade.checkCloseOrders();
  }

  public async setRates(rates: ExchangePairRatesDto) {
    for (const [exchangeId, pairRates] of Object.entries(rates)) {
      for (const [pairName, rate] of Object.entries(pairRates)) {
        const pair = await this.pairs.fetchOrCreate(Number(exchangeId), pairName);
        await this.pairs.setInfo(pair, {
          buyRate: (rate as RateDto).bid,
          sellRate: (rate as RateDto).ask,
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
    api: PublicApiService,
    pairName: string,
  ): Promise<{ bid: number; ask: number }> {
    return api.getActualRates(pairName);
  }

  public async getActiveOrdersSum(
    accountId: number,
    currency1: string,
    attribute: string,
  ) {
    return this.orders.getActiveOrdersSum(accountId, currency1, attribute);
  }

  public getApiForExchange(exchange: Exchange): PublicApiService {
    return this.exchange.getApiForExchange(exchange);
  }

  public async checkRates(
    pairs: Array<string>,
    minBuyRateMarginToProcess: number,
    minSellRateMarginToProcess: number,
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
      const api = this.exchange.getApiForExchange(exchange);

      for (const pairName of pairs) {

        if (!this.lastRates[exchange.id][pairName]) {
          this.lastRates[exchange.id][pairName] = {
            bid: 0,
            ask: 0,
          };
        }
        const lastRates = this.lastRates[exchange.id][pairName];
        const rates = await api.getActualRates(pairName);

        const isCurrentBidMargined = isSuitableRate(
          rates.bid,
          lastRates.bid,
          minBuyRateMarginToProcess,
        );
        const isCurrentAskMargined = isSuitableRate(
          rates.ask,
          lastRates.ask,
          minSellRateMarginToProcess,
        );

        if (isCurrentBidMargined) {
          changedPairs[exchange.id] = changedPairs[exchange.id] || {};
          changedPairs[exchange.id][pairName] = rates;

          this.log.info(`[${exchange.alias}] Rates by ${pairName} bid:`, rates.bid);
          lastRates.bid = rates.bid;
        }

        if (isCurrentAskMargined) {
          changedPairs[exchange.id] = changedPairs[exchange.id] || {};
          changedPairs[exchange.id][pairName] = rates;

          this.log.info(`[${exchange.alias}] Rates by ${pairName} ask:`, rates.ask);
          lastRates.ask = rates.ask;
        }

        isBidMargined = isBidMargined || isCurrentBidMargined;
        isAskMargined = isAskMargined || isCurrentAskMargined;
      }
    }
    return { isBidMargined, isAskMargined, changedPairs };
  }
}
