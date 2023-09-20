import { Injectable } from "@nestjs/common";
import { checkLimits, elapsedSecondsFrom, extractCurrency, lock, updateModel } from "../helpers/helpers";
import { PublicApiService } from "./publicApi.service";
import { InjectRepository } from "@nestjs/typeorm";
import { Pair } from "./entities/pair.entity";
import { Repository } from "typeorm";

@Injectable()
export class PairService  {

  pairs:{ [id: string]: Pair }={};

  FETCH_TIMEOUT;
  minAmount;
  minCost;
  publicApi: PublicApiService;
  
  constructor(
    @InjectRepository(Pair)
    private pairRepository: Repository<Pair>
  ) {    
    this.FETCH_TIMEOUT = Number(process.env.EXCHANGE_RATES_FETCH_TIMEOUT);  
  }

  public setPublicApi(api:PublicApiService) {
    this.publicApi = api;
  }

  public async fetchOrCreate(exchange_id: number, pairName: string): Promise<Pair> {
    let pair = await this.pairRepository.findOneBy({exchange_id, name: pairName});
    if (!pair) {
      const {currency1, currency2} = extractCurrency(pairName);
      pair = this.pairRepository.create({exchange_id, name: pairName, currency1, currency2})
      await this.pairRepository.save(
        pair
      );            
    }
    return pair;
  }

  async setInfo(pairModel, data) {
    updateModel(pairModel, data);
    
    await this.pairRepository.save(
      pairModel
    );
  }

  async actualize(api: PublicApiService, pair:Pair) {
    const {bid, ask} = await api.getActualRates(pair.name);
    const { minAmount, minCost, fee } = await api.getMarketInfo(pair.name);

    let historicalMinRate = pair.historicalMinRate;
    if (historicalMinRate > bid) {
      historicalMinRate = bid;
    }

    await this.setInfo(pair, {      
      buyRate: bid,
      sellRate: ask,
      minAmount1: checkLimits(minAmount, minCost, ask),
      minAmount2: minCost,
      historicalMinRate,
      fee
    });
  }


}