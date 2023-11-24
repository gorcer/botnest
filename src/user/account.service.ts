import { Injectable } from '@nestjs/common';
import { ApiService } from '../exchange/api.service';
import { InjectRepository } from '@nestjs/typeorm';
import { Account } from './entities/account.entity';
import { Repository } from 'typeorm';
import { updateModel } from '../helpers/helpers';
import { UpdateAccountDto } from './dto/update-account.dto';

@Injectable()
export class AccountService {
  exchanges = {};
  accounts = {};

  constructor(
    private apiService: ApiService,

    @InjectRepository(Account)
    private repository: Repository<Account>,
  ) {}

  public async fetchOrCreate(userId: number): Promise<Account> {
    let account = await this.repository.findOneBy({ userId });
    if (!account) {
      account = this.repository.create({ userId });
      await this.repository.save(account);
    }
    return account;
  }

  async setAccount(
    account: Account,
    config: UpdateAccountDto,
  ): Promise<Account> {
    updateModel(account, config);
    await this.repository.save(account);

    this.accounts[account.id] = account;
    return this.accounts[account.id];
  }

  async getApiForAccount(accountId: number) {
    if (!this.exchanges[accountId]) {
      if (!this.accounts[accountId]) {
        this.accounts[accountId] = await this.repository.findOne({
          where: {
            id: accountId,
          },
          relations: ['exchange'],
        });
      }

      const account = this.accounts[accountId];

      if (!account) {
        throw new Error('Unknown account ' + accountId);
      }

      this.exchanges[accountId] = this.apiService.getApi(
        account.exchangeClass || account.exchange.exchange_name,
        account.apiKey,
        account.secret,
        account.password,
        account.exchange.test_mode,
      );

    }
    this.exchanges[accountId].exchange_id = this.accounts[accountId].exchange_id;

    return this.exchanges[accountId];
  }
}
