import { Injectable } from '@nestjs/common';
import { BalancesDto } from './dto/balances.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Balance } from './entities/balance.entity';
import { Repository } from 'typeorm';
import { lock } from '../helpers/helpers';
import { FileLogService } from '../log/filelog.service';
import { BalanceLog, OperationType } from './entities/balanceLog.entity';
const { compareTo, multiply, add, subtract } = require('js-big-decimal');
import * as _ from 'lodash';

@Injectable()
export class BalanceService {
  constructor(
    @InjectRepository(Balance)
    private balanceRepository: Repository<Balance>,

    @InjectRepository(BalanceLog)
    private balanceLogRepository: Repository<BalanceLog>,

    private log: FileLogService,
  ) {}

  public async set(accountId: number, balances: BalancesDto) {
    return await lock.acquire('Balance', async () => {
      let operationType: OperationType;
      let operationAmount;

      let existedBalances = await this.balanceRepository.find({
        where: { accountId },
      });
      existedBalances = _.keyBy(existedBalances, 'currency');

      for (const [currency, amount] of Object.entries(balances)) {
        operationType = null;
        let balance = existedBalances[currency];
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
          if (operationType) {
            await this.balanceRepository.save(balance);
            await this.balanceLogRepository.save(
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

  public async getBalance(
    accountId: number,
    currency: string,
  ): Promise<Balance> {
    return this.balanceRepository.findOne({
      where: { accountId, currency },
    });
  }

  public async getBalances(accountId: number): Promise<Balance[]> {
    return this.balanceRepository.find({
      where: { accountId },
    });
  }

  public async getBalanceAmount(accountId: number, currency: string) {
    const balance = await this.getBalance(accountId, currency);
    if (balance) {
      return balance.amount;
    } else {
      return 0;
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
    if (compareTo(amount, 0) == 0) return;

    return await lock.acquire('Balance ' + currency + accountId, async () => {
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
    });
  }

  public outcome(
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
