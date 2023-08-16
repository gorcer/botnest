import { Injectable } from "@nestjs/common";
import { ApiService } from "../exchange/api.service";
import { InjectRepository } from "@nestjs/typeorm";
import { Account } from "./entities/account.entity";
import { Repository } from "typeorm";
import { updateModel } from "../helpers";
import { UpdateAccountDto } from "./dto/update-account.dto";

@Injectable()
export class AccountService {

    exchanges = {};
    accounts = {};

    constructor(
        @InjectRepository(Account)
        private repository: Repository<Account>
    ) {

    }

    public async fetchOrCreate(userId: number): Promise<Account> {
        let account = await this.repository.findOneBy({ userId });
        if (!account) {
            account = this.repository.create({ userId })
            await this.repository.save(
                account
            );
        }
        return account;
    }

    async setAccount(account: Account, config:UpdateAccountDto): Promise<Account> {

        updateModel(account, config);
        await this.repository.save(
            account
        );

        this.accounts[account.id] = account;
        return this.accounts[account.id];
    }


    async getApiForAccount(accountId: number):Promise<ApiService> {

        if (!this.exchanges[accountId]) {
            

            if (!this.accounts[accountId]) {
                this.accounts[accountId] = await this.repository.findOneBy({ id:accountId });
            }

            let account = this.accounts[accountId];

            if (!account) {
                throw new Error('Unknown account ' + accountId);
            }

            if (account.exchangeClass) {
                this.exchanges[accountId] = new ApiService(account.exchangeClass, account.apiKey, account.secret, account.testMode)
            } else {
                this.exchanges[accountId] = new ApiService(account.exchangeName, account.apiKey, account.secret, account.testMode);
            }
        }

        return this.exchanges[accountId];
    }

}