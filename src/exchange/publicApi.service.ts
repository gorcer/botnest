import { Injectable } from "@nestjs/common";
import { ApiService } from "./api.service";
import { pro as ccxt } from "ccxt";
import { elapsedSecondsFrom, lock } from "../helpers/helpers";

export class PublicApiService extends ApiService {

  lastPrice;
  rates;
  lastRatesFetchTime;
  lastPriceFetchTime;
  FETCH_TIMEOUT;

  constructor(exchange_name: string, test_mode: boolean) {

    super(
      ccxt[exchange_name],
      '',
      '',
      test_mode
    );

    this.lastPrice = {};
    this.rates = {};
    this.lastRatesFetchTime = {};
    this.lastPriceFetchTime = {};
    this.FETCH_TIMEOUT = Number(process.env.EXCHANGE_RATES_FETCH_TIMEOUT);
  }

  async getLastPrice(pair: string): Promise<number> {
    if (!this.lastPrice[pair] ||
      !this.lastPriceFetchTime[pair] ||
      elapsedSecondsFrom(this.FETCH_TIMEOUT, this.lastPriceFetchTime[pair])) {

      await lock.acquire('fetchLastPrice ' + pair, async () => {

        if (this.lastPrice[pair] &&
          this.lastPriceFetchTime[pair] &&
          !elapsedSecondsFrom(this.FETCH_TIMEOUT, this.lastPriceFetchTime[pair])) {
          return this.lastPrice[pair];
        }

        this.lastPriceFetchTime[pair] = Date.now() / 1000;
        this.lastPrice[pair] = await super.getLastPrice(pair);
      });
    }

    return this.lastPrice[pair];
  }

  async getActualRates(pairName: string) {

    if (!this.rates[pairName] ||
      !this.lastRatesFetchTime[pairName] ||
      elapsedSecondsFrom(this.FETCH_TIMEOUT, this.lastRatesFetchTime[pairName])) {

      await lock.acquire('fetchRates ' + pairName, async () => {

        if (this.rates[pairName] &&
          this.lastRatesFetchTime[pairName] &&
          !elapsedSecondsFrom(this.FETCH_TIMEOUT, this.lastRatesFetchTime[pairName])) {
          return this.rates[pairName];
        }

        this.lastRatesFetchTime[pairName] = Date.now() / 1000;
        this.rates[pairName] = await super.getActualRates(pairName);


      });

    }

    return this.rates[pairName];
  }

}