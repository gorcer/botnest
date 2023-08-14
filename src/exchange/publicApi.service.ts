import { Injectable } from "@nestjs/common";
import { ApiService } from "./api.service";
import { pro as ccxt } from "ccxt";
import { elapsedSecondsFrom, lock } from "../helpers";

@Injectable()
export class PublicApiService extends ApiService {

  lastPrice;
  rates;
  lastRatesFetchTime;
  lastPriceFetchTime;
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

    this.lastPrice = {};
    this.rates = {};
    this.lastRatesFetchTime = {};
    this.lastPriceFetchTime = {};
    this.FETCH_TIMEOUT = Number(process.env.EXCHANGE_RATES_FETCH_TIMEOUT);
  }

  async getLastPrice(pair: string):Promise<number> {
    if (!this.lastPrice[pair] ||
      !this.lastPriceFetchTime[pair] ||
      elapsedSecondsFrom(this.FETCH_TIMEOUT, this.lastPriceFetchTime[pair])) {

      await lock.acquire('fetchLastPrice ' + pair, async () => {

        if (this.lastPrice[pair] &&
          this.lastPriceFetchTime[pair] &&
          !elapsedSecondsFrom(this.FETCH_TIMEOUT, this.lastPriceFetchTime[pair])) {
          return this.lastPrice[pair];
        }

        this.lastPriceFetchTime[pair] = Date.now()/1000;
        this.lastPrice[pair] = await super.getLastPrice(pair);


      });

    }

    return this.lastPrice[pair];
  }

  async getActualRates(pair: string) {

    if (!this.rates[pair] ||
      !this.lastRatesFetchTime[pair] ||
      elapsedSecondsFrom(this.FETCH_TIMEOUT, this.lastRatesFetchTime[pair])) {

      await lock.acquire('fetchRates ' + pair, async () => {

        if (this.rates[pair] &&
          this.lastRatesFetchTime[pair] &&
          !elapsedSecondsFrom(this.FETCH_TIMEOUT, this.lastRatesFetchTime[pair])) {
          return this.rates[pair];
        }

        this.lastRatesFetchTime[pair] = Date.now()/1000;
        this.rates[pair] = await super.getActualRates(pair);


      });

    }

    return this.rates[pair];
  }

}