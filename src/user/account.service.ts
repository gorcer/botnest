import { Inject, Injectable } from '@nestjs/common';
import { ApiService } from '../exchange/api.service';
import { InjectRepository } from '@nestjs/typeorm';
import { Account } from './entities/account.entity';
import { Repository } from 'typeorm';
import { updateModel } from '../helpers/helpers';
import { UpdateAccountDto } from './dto/update-account.dto';
import { Exchange } from 'ccxt';
import { FileLogService } from '../log/filelog.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  ERROR_CODE_TRADING_NOT_ALLOWED,
  ERRORS_TRADING_NOT_ALLOWED,
} from '../exchange/errorCodes';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { CcxtExchangeDto } from '../exchange/dto/CcxtExchange.dts';

@Injectable()
export class AccountService {
  constructor(
    private apiService: ApiService,
    private eventEmitter: EventEmitter2,
    private log: FileLogService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,

    @InjectRepository(Account)
    private repository: Repository<Account>,
  ) {
    this.handleApiError = this.handleApiError.bind(this);
    this.setNoErrors = this.setNoErrors.bind(this);

    this.eventEmitter.on('api.error', this.handleApiError);
    this.eventEmitter.on('buyOrder.created', this.setNoErrors);
    this.eventEmitter.on('buyOrder.closed', this.setNoErrors);
  }

  private async setNoErrors(context) {
    const { orderInfo } = context;
    const { account_id } = orderInfo;
    const account = await this.getAccount(account_id);
    if (account.error_code) {
      this.setAccount(account, {
        error_code: null,
      });
    }
  }

  public async handleApiError(context) {
    const { api, message, code } = context;
    const { account_id } = api;
    const account = await this.getAccount(account_id);
    const apiName = api.name.toLowerCase();

    if (ERRORS_TRADING_NOT_ALLOWED[apiName].includes(parseInt(code))) {
      this.setAccount(account, {
        error_code: ERROR_CODE_TRADING_NOT_ALLOWED,
        is_connected: false,
      });
      this.log.info(
        'Disable account ' +
          account_id +
          ' with error (' +
          code +
          ')' +
          message,
      );
    }
  }

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

    await this.cacheManager.del('account.' + account.id);
    return account;
  }

  async getAccount(accountId: number): Promise<Account> {
    const key = 'account.' + accountId;
    let account: Account = await this.cacheManager.get(key);
    if (account) return account;

    account = await this.repository.findOne({
      where: {
        id: accountId,
      },
      relations: ['exchange'],
    });
    await this.cacheManager.set(key, account, 10*60*1000);

    // if (!this.accounts[accountId]) {
    //   this.accounts[accountId] = await this.repository.findOne({
    //     where: {
    //       id: accountId,
    //     },
    //     relations: ['exchange'],
    //   });
    // }
    // return this.accounts[accountId];
    return account;
  }

  async getApiForAccount(accountId: number): Promise<CcxtExchangeDto> {
    if (accountId == undefined) {
      throw new Error('AccountId is undefined');
    }

    const key = 'api.' + accountId;
    let api: CcxtExchangeDto = await this.cacheManager.get(key);

    if (!api) {
      const account = await this.getAccount(accountId);

      if (!account) {
        throw new Error('Unknown account ' + accountId);
      }      

      api = (await this.apiService.getApi(
        // account.exchangeClass || account.exchange.exchange_name,
        account.exchange.exchange_name,
        account.apiKey,
        account.secret,
        account.password,
        account.exchange.test_mode,
      )) as CcxtExchangeDto;

      api.exchange_id = account.exchange_id;
      api.account_id = accountId;

      await this.apiService.loadMarkets(api);

      await this.cacheManager.set(key, api, 10*60*1000);

      this.log.info('Get api for account ' + accountId);
    }

    return api;
  }
}
