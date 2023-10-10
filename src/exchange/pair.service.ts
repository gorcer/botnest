import { Injectable } from '@nestjs/common';
import {
  checkLimits,
  elapsedSecondsFrom,
  extractCurrency,
  lock,
  numberTrim,
  updateModel,
} from '../helpers/helpers';
import { InjectRepository } from '@nestjs/typeorm';
import { Pair } from './entities/pair.entity';
import { Repository } from 'typeorm';
import { ApiService } from './api.service';
import { compareTo, divide, multiply } from '../helpers/bc';

@Injectable()
export class PairService {
  pairs: { [id: string]: Pair } = {};

  FETCH_TIMEOUT;
  minAmount;
  minCost;

  constructor(
    private apiService: ApiService,
    @InjectRepository(Pair)
    private pairRepository: Repository<Pair>,
  ) {
    this.FETCH_TIMEOUT = Number(process.env.EXCHANGE_RATES_FETCH_TIMEOUT);
  }

  public async fetchOrCreate(
    exchange_id: number,
    pairName: string,
  ): Promise<Pair> {
    let pair = await this.pairRepository.findOneBy({
      exchange: { id: exchange_id },
      name: pairName,
    });
    if (!pair) {
      const { currency1, currency2 } = extractCurrency(pairName);
      pair = this.pairRepository.create({
        exchange: { id: exchange_id },
        name: pairName,
        currency1,
        currency2,
      });
      await this.pairRepository.save(pair);
    }
    return pair;
  }

  async setInfo(pairModel, data) {
    updateModel(pairModel, data);

    await this.pairRepository.save(pairModel);
  }

  async actualize(api, pairName: string, exchangeId: number) {
    const marketInfo = await this.apiService.getMarketInfo(api, pairName);
    if (!marketInfo) return null;

    let { minAmount, minCost, fee, pricePrecision, amountPrecision } = marketInfo;
    const { bid, ask } = await this.apiService.getActualRates(api, pairName);
    const pair = await this.fetchOrCreate(exchangeId, pairName);

    let historicalMinRate = pair.historicalMinRate;
    if (historicalMinRate > bid) {
      historicalMinRate = bid;
    }
      
    if(!minCost || compareTo(minCost, 0) == 0) {
      minCost = multiply(minAmount, bid);
      minCost = numberTrim(minCost, pricePrecision);
    }

    // @todo придумать что-то поумнее
    // если при обратном рассчете оказались меньше minAmount, на всякий случай добавляем 50%
    const checkAmount = divide(minCost, bid, amountPrecision);
    if (compareTo(checkAmount, minAmount)<0) {
      minAmount = multiply(minAmount, 1.5);
      minCost = multiply(minCost, 1.5);

      minAmount = numberTrim(minAmount, amountPrecision);
      minCost = numberTrim(minCost, pricePrecision);
    }


    await this.setInfo(pair, {
      buyRate: bid,
      sellRate: ask,
      minAmount1: checkLimits(minAmount, minCost, ask),
      minAmount2: minCost,
      historicalMinRate,
      fee,
    });

    return pair;
  }
}
