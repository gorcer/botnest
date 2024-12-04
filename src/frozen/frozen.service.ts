import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ApiService } from '../exchange/api.service';
import { add, compareTo, divide, multiply, subtract } from '../helpers/bc';
import { FileLogService } from '../log/filelog.service';
import { AccountService } from '../user/account.service';
import { Frozen } from './frozen.entity';

@Injectable()
export class FrozenService {
  defCurrency = 'USDT';

  constructor(
    @InjectRepository(Frozen)
    private frozenRepository: Repository<Frozen>,
    private log: FileLogService,
    private accounts: AccountService,
    private eventEmitter: EventEmitter2,
    private apiService: ApiService,
  ) {
    this.buyOrderCreatedWithoutFee = this.buyOrderCreatedWithoutFee.bind(this);
    this.buyOrderCreated = this.buyOrderCreated.bind(this);
    this.buyOrderClosed = this.buyOrderClosed.bind(this);

    this.eventEmitter.on('buyOrder.created', this.buyOrderCreatedWithoutFee);
    this.eventEmitter.on('buyOrder.closed', this.buyOrderClosed);
    this.eventEmitter.on('fee.transferred', this.buyOrderCreated);
  }

  public async getBalance(
    account_id: number,
    currency: string,
  ): Promise<Frozen> {
    let balance = await this.frozenRepository.findOneBy({
      account_id,
      currency,
    });

    if (balance == null) {
      balance = await this.frozenRepository.create({
        account_id,
        currency,
        amount: 0,
        amount_in_usd: 0,
      });
    }

    return balance;
  }

  public async setBalance(
    accountId: number,
    currency: string,
    amount1: number,
    amount2: number,
  ) {
    const balance = await this.getBalance(accountId, currency);
    balance.amount = amount1;
    balance.amount_in_usd = amount2;
    if (compareTo(balance.amount, 0) == 0) balance.avg_rate = 0;
    else balance.avg_rate = divide(balance.amount_in_usd, balance.amount);
    await this.frozenRepository.save(balance);
  }

  public async income(
    api,
    accountId: number,
    currency1: string,
    amount1: number,
    currency2: string,
    amount2: number,
  ) {
    if (compareTo(amount1, 0) == 0) return;

    let amount_in_usd = amount2;
    if (currency2 != this.defCurrency) {
      const rate = await this.getRate(api, currency2);
      amount_in_usd = multiply(rate, amount2);
    }
    const balance = await this.getBalance(accountId, currency1);

    balance.amount = add(balance.amount, amount1);
    balance.amount_in_usd = add(balance.amount_in_usd, amount_in_usd);
    if (compareTo(balance.amount, 0) == 0) balance.avg_rate = 0;
    else balance.avg_rate = divide(balance.amount_in_usd, balance.amount);

    await this.frozenRepository.save(balance);

    this.log.write('frozen.' + accountId, [
      'income (' + amount1 + ',' + amount2 + ')',
      'amount: ' + balance.amount,
      'amount_in_usd: ' + balance.amount_in_usd,
      'avg_rate: ' + balance.avg_rate,
    ]);

    return balance;
  }

  public async outcome(
    accountId: number,
    currency: string,
    amount: number,
    amount_in_usd: number = null,
  ) {
    if (compareTo(amount, 0) == 0) return;

    const balance = await this.getBalance(accountId, currency);

    if (amount_in_usd == null) {
      amount_in_usd = amount;
      if (currency != this.defCurrency) {
        amount_in_usd = multiply(amount, balance.avg_rate);
      }
    }

    balance.amount = subtract(balance.amount, amount);
    balance.amount_in_usd = subtract(balance.amount_in_usd, amount_in_usd);
    balance.avg_rate = divide(balance.amount_in_usd, balance.amount);

    await this.frozenRepository.save(balance);

    this.log.write('frozen.' + accountId, [
      'outcome (' + amount + ',' + amount_in_usd + ')',
      'amount: ' + balance.amount,
      'amount_in_usd: ' + balance.amount_in_usd,
      'avg_rate: ' + balance.avg_rate,
    ]);

    return balance;
  }

  async getRate(api, currency: string): Promise<number> {
    return await this.apiService.getLastPrice(
      api,
      currency + '/' + this.defCurrency,
    );
  }

  async buyOrderCreatedWithoutFee({
    // feeCurrency,
    // feeCost,
    orderInfo,
  }) {
    const api = await this.accounts.getApiForAccount(orderInfo.accountId);

    let result = await this.income(
      api,
      orderInfo.accountId,
      orderInfo.currency1,
      orderInfo.amount1,
      orderInfo.currency2,
      orderInfo.amount2,
    );

    // Перенесли в outcome
    // if (feeCurrency == orderInfo.currency1)
    //     result = await this.outcome(
    //         orderInfo.account_id,
    //         feeCurrency,
    //         feeCost
    //     );

    return result;
  }

  async buyOrderCreated({ feeCurrency, feeCost, orderInfo }) {
    const api = await this.accounts.getApiForAccount(orderInfo.accountId);

    let result = await this.income(
      api,
      orderInfo.accountId,
      orderInfo.currency1,
      orderInfo.amount1,
      orderInfo.currency2,
      orderInfo.amount2,
    );

    if (feeCurrency == orderInfo.currency1)
      result = await this.outcome(orderInfo.accountId, feeCurrency, feeCost);

    return result;
  }

  async buyOrderClosed({ orderInfo, feeCurrency, feeCost }) {
    if (feeCurrency == orderInfo.currency1)
      await this.outcome(orderInfo.accountId, feeCurrency, feeCost);

    // Отнимаем комиссию родительского ордера
    if (compareTo(orderInfo.fee, 0) > 0) {
      await this.outcome(
        orderInfo.accountId,
        orderInfo.currency1,
        orderInfo.fee,
      );
    }

    return await this.outcome(
      orderInfo.accountId,
      orderInfo.currency1,
      orderInfo.amount1,
      orderInfo.amount2,
    );
  }
}
