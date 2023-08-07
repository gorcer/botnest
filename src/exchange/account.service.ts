import { Injectable } from "@nestjs/common";
import { ApiService } from "./api.service";
import {pro as ccxt} from "ccxt";

@Injectable()
export class AccountService {

    exchanges={};
    accounts={};

    constructor() {
      
    }

    setAccount(id, config) {
        this.accounts[id] = config;
    }


    getApiForAccount(accountId:number) {
        
        if (!this.exchanges[accountId]) {
            const account = this.accounts[accountId];
            if (account.exchangeClass) {
                this.exchanges[accountId] = new ApiService(account.exchangeClass, account.apiKey, account.secret, account.isSandbox)
            } else {
                this.exchanges[accountId] = new ApiService(account.exchangeName, account.apiKey, account.secret, account.isSandbox);
            }
        }

        return this.exchanges[accountId];
    }

    getConfig(accountId:number) {
        return this.accounts[accountId];
    }

}