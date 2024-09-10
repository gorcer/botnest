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

export enum OperationContext {
  IN_ORDERS = "in_orders",
  FOR_FEE = "for_fee"
}


@Injectable()
export class BalanceService {
  constructor(
    @InjectRepository(Balance)
    public balanceRepository: Repository<Balance>,

    @InjectRepository(BalanceLog)
    private balanceLogRepository: Repository<BalanceLog>,

    private log: FileLogService,
  ) {}

  public async set(account_id: number, balances: BalancesDto) {
    return await lock.acquire('Balance', async () => {
      let operationType: OperationType;
      let operationAmount;

      let existedBalances = await this.balanceRepository.find({
        where: { account_id },
      });
      existedBalances = _.keyBy(existedBalances, 'currency');

      for (const [currency, amount] of Object.entries(balances)) {
        operationType = null;
        let balance = existedBalances[currency];
        if (!balance) {
          if (compareTo(amount, 0) > 0) {
            balance = await this.balanceRepository.create({
              account_id,
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
            balance.available = subtract(
                                  subtract(balance.amount, balance.in_orders),
                                  balance.for_fee
                                  );
          }
        }

        if (balance) {
          if (operationType) {
            await this.balanceRepository.save(balance);
            await this.balanceLogRepository.save(
              this.balanceLogRepository.create({
                accountId: balance.account_id,
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
    account_id: number,
    currency: string,
  ): Promise<Balance> {
    let balance = await this.balanceRepository.findOneBy({ account_id, currency });

    if (balance == null) {
      balance = await this.balanceRepository.create({
        account_id,
        currency,
        amount: 0,
        available: 0,
      });
    }

    return balance;
  }

  public async getBalances(account_id: number): Promise<Balance[]> {
    return this.balanceRepository.find({
      where: { account_id },
    });
  }

  public async getBalanceAmount(account_id: number, currency: string) {
    const balance = await this.getBalance(account_id, currency);
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
    account_id: number,
    currency: string,
    sourceId: number,
    operationType: OperationType,
    amount: number,
    context:  OperationContext = null
  ) {
    if (compareTo(amount, 0) == 0) return;

    return await lock.acquire('Balance ' + account_id, async () => {

      const balance = await this.getBalance(account_id, currency);     
      balance.amount = add(balance.amount, amount);

      if (context == OperationContext.IN_ORDERS) {
        balance.in_orders = add(balance.in_orders, amount);
      }

      if (context == OperationContext.FOR_FEE) {
        balance.for_fee = add(balance.for_fee, amount);
      }

      balance.available = subtract(
                            subtract(balance.amount, balance.in_orders),
                            balance.for_fee
                          );
      if (compareTo(balance.available, 0) < 0) {
        this.log.error('Available balance became negative ' + balance.available);
      }

      await this.balanceRepository.save(balance);

      await this.balanceLogRepository.save(
        this.balanceLogRepository.create({
          accountId: balance.account_id,
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
    account_id: number,
    currency: string,
    sourceId: number,
    operationType: OperationType,
    amount: number,
    context:  OperationContext = null
  ) {
    return this.income(
      account_id,
      currency,
      sourceId,
      operationType,
      multiply(-1, amount),
      context,
    );
  }
}
