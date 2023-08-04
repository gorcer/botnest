import { Injectable } from "@nestjs/common";
import { ApiService } from "./api.service";
import {pro as ccxt} from "ccxt";
import { elapsedSecondsFrom, lock } from "../helpers";

@Injectable()
export class PublicApiService extends ApiService{

    lastPrice;
    rates;
    lastFetchTime;
    FETCH_TIMEOUT;

    

    constructor() {
        if (process.env.BOT_TEST == 'true') {
            super(
              ccxt[process.env.EXCHANGE_NAME],
              '',
              '',
              true
            );
          } else {
            super(
              ccxt[process.env.EXCHANGE_NAME],
              '',
              '',              
              false
            );
          }

          this.lastPrice={};
          this.rates = {};
          this.lastFetchTime = {};
          this.FETCH_TIMEOUT = Number(process.env.EXCHANGE_RATES_FETCH_TIMEOUT) * 1000;
    }

    async getLastPrice(pair) {
      await this.getActualRates(pair);
      return await this.lastPrice[pair];
    }
    

    async getActualRates(pair: string) {

        if (!this.rates[pair] ||
            !this.lastFetchTime[pair] ||
            elapsedSecondsFrom(this.FETCH_TIMEOUT, this.lastFetchTime[pair])) {

            await lock.acquire('fetchRates ' + pair, async () => {

                if (this.rates[pair]&&
                    this.lastFetchTime[pair] &&
                    !elapsedSecondsFrom(this.FETCH_TIMEOUT, this.lastFetchTime[pair])) {
                    return this.rates[pair];
                }

                this.lastFetchTime[pair] = Date.now();
                this.rates[pair] = await super.getActualRates(pair);
                this.lastPrice[pair] = this.rates[pair].ask;

            });

        }

        return this.rates[pair];
    }

}