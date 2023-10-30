import { Injectable } from '@nestjs/common';
import { BalancesDto } from './dto/balances.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Balance } from './entities/balance.entity';
import { Repository } from 'typeorm';
import { lock } from '../helpers/helpers';
import { FileLogService } from '../log/filelog.service';
import { BalanceLog, OperationType } from './entities/balanceLog.entity';
const { compareTo, multiply, add, subtract } = require('js-big-decimal');

@Injectable()
export class BalanceService {
  balances:
    | {
        (account_id: number): Balance;
      }
    | {} = {};

  constructor(
    @InjectRepository(Balance)
    private balanceRepository: Repository<Balance>,

    @InjectRepository(BalanceLog)
    private balanceLogRepository: Repository<BalanceLog>,

    private log: FileLogService,
  ) {}

  public async set(accountId: number, balances: BalancesDto) {
    if (!this.balances[accountId]) {
      this.balances[accountId] = {};
    }

    return await lock.acquire('Balance', async () => {
      let operationType: OperationType;
      let operationAmount;

      for (const [currency, amount] of Object.entries(balances)) {
        let balance = await this.getBalance(accountId, currency);
        if (!balance) {
          if (compareTo(amount, 0) > 0) {
            balance = this.balanceRepository.create({
              accountId,
              currency,
              amount: amount,
              available: amount,
            });
            operationType = OperationType.INIT;
            operationAmount = amount;
            this.balances[accountId][currency] = balance;
          }
        } else {
          if (compareTo(balance.amount, amount) != 0) {
            this.log.info(
              'Balance discrepancy',
              currency,
              'Need:',
              balance.amount,
              'Reel:',
              amount,
            );
            operationType = OperationType.ACTUALIZE;
            operationAmount = subtract(amount, balance.amount);
            balance.amount = amount;
            balance.available = subtract(balance.amount, balance.inOrders);
          }
        }

        if (balance) {
          await this.balanceRepository.save(balance);

          if (operationType) {
            this.balanceLogRepository.save(
              this.balanceLogRepository.create({
                accountId: balance.accountId,
                balanceId: balance.id,
                operationType,
                amount: operationAmount,
                total: balance.amount,
              }),
            );
          }
        }
      }
    });
  }

  public async loadBalances(accountId: number) {
    const balances = await this.balanceRepository.find({
      where: { accountId },
    });
    for (const balance of balances) {
      if (!this.balances[accountId]) this.balances[accountId] = {};

      this.balances[accountId][balance.currency] = balance;
    }
    return this.balances[accountId];
  }

  public async getBalance(
    accountId: number,
    currency: string,
  ): Promise<Balance> {
    await this.checkBalances(accountId);
    if (this.balances[accountId]?.[currency] != undefined) {
      return this.balances[accountId][currency];
    } else {
      return null;
    }
  }

  public async getBalanceAmount(accountId: number, currency: string) {
    const balance = await this.getBalance(accountId, currency);
    if (balance) {
      return balance.amount;
    } else {
      return 0;
    }
  }

  private async checkBalances(accountId) {
    if (
      !this.balances[accountId] ||
      Object.keys(this.balances[accountId]).length == 0
    ) {
      return this.loadBalances(accountId);
    }
  }

  public async saveBalance(balance: Balance) {
    await this.balanceRepository.save(balance);
  }

  public async income(
    accountId: number,
    currency: string,
    sourceId: number,
    operationType: OperationType,
    amount: number,
    inOrders = false,
  ) {
    const balance = await this.getBalance(accountId, currency);
    if (!balance) {
      throw new Error('Unknown balance ' + accountId + ' ' + currency);
    }
    balance.amount = add(balance.amount, amount);
    if (inOrders) {
      balance.inOrders = add(balance.inOrders, amount);
    }
    balance.available = subtract(balance.amount, balance.inOrders);
    if (compareTo(balance.available, 0) < 0) balance.available = 0;

    await this.balanceRepository.save(balance);

    this.balanceLogRepository.save(
      this.balanceLogRepository.create({
        accountId: balance.accountId,
        balanceId: balance.id,
        operationType,
        amount: amount,
        total: balance.amount,
        sourceId,
      }),
    );

    return balance;
  }

  public async outcome(
    accountId: number,
    currency: string,
    sourceId: number,
    operationType: OperationType,
    amount: number,
    inOrders = false,
  ) {
    return this.income(
      accountId,
      currency,
      sourceId,
      operationType,
      multiply(-1, amount),
      inOrders,
    );
  }
}
