import { Injectable } from "@nestjs/common";
import { checkLimits, elapsedSecondsFrom, extractCurrency, lock, updateModel } from "../helpers";
import { PublicApiService } from "./publicApi.service";
import { InjectRepository } from "@nestjs/typeorm";
import { Pair } from "./entities/pair.entity";
import { Repository } from "typeorm";

@Injectable()
export class PairService  {

  pairs:{ [id: string]: Pair }={};
  lastRequestTime={};  
  FETCH_TIMEOUT;
  minAmount;
  minCost;

  constructor(
    
    public publicApi: PublicApiService,

    @InjectRepository(Pair)
    private pairRepository: Repository<Pair>
  ) {    
    this.FETCH_TIMEOUT = Number(process.env.EXCHANGE_RATES_FETCH_TIMEOUT);
    
  }

  public async fetchOrCreatePair(pairName: string): Promise<Pair> {
    let pair = await this.pairRepository.findOneBy({name: pairName});
    if (!pair) {
      const {currency1, currency2} = extractCurrency(pairName);
      pair = this.pairRepository.create({name: pairName, currency1, currency2})
      await this.pairRepository.save(
        pair
      );      
      this.lastRequestTime[pairName] = 1;
    }
    return pair;
  }



  // async getOrRefreshPair(currency1: string, currency2: string):Promise<Pair> {

  //   const pair = currency1 + '/' + currency2;
  //   if (!this.pairs[pair]) {
  //     this.pairs[pair] = await this.fetchOrCreatePair(currency1, currency2);
  //   }

  //   if (!this.lastRequestTime[pair]) {
  //     this.lastRequestTime[pair] = 1;
  //   }


  //   if ( elapsedSecondsFrom(this.FETCH_TIMEOUT, this.lastRequestTime[pair]) ) {

  //     await lock.acquire('requestLastPair ' + pair, async () => {

  //       if ( !elapsedSecondsFrom(this.FETCH_TIMEOUT, this.lastRequestTime[pair])) {
  //         return this.pairs[pair];
  //       }

  //       this.lastRequestTime[pair] = Date.now()/1000;
  //       await this.refreshPairInfo(currency1, currency2);

  //     });

  //   }

  //   return this.pairs[pair];
  // }

  async setInfo(pairModel, data) {
    updateModel(pairModel, data);
    
    await this.pairRepository.save(
      pairModel
    );
  }

  async actualize(pair:Pair) {
    const {bid, ask} = await this.publicApi.getActualRates(pair.name);
    const { minAmount, minCost, fee } = await this.publicApi.getMarketInfo(pair.name);

    await this.setInfo(pair, {      
      buyRate: bid,
      sellRate: ask,
      minAmount1: checkLimits(minAmount, minCost, ask),
      minAmount2: minCost,
      fee
    });
  }

  // public async refreshPairInfo(currency1: string, currency2: string) {
  //   const pair = currency1 + '/' + currency2;

  //   const lastPrice = await this.publicApi.getLastPrice(pair);
  //   const {bid, ask} = await this.publicApi.getActualRates(pair);
  //   const { minAmount, minCost, fee } = await this.publicApi.getMarketInfo(pair);

  //   await this.setInfo(this.pairs[pair], {
  //     lastPrice,
  //     buyRate: bid,
  //     sellRate: ask,
  //     minAmount1: checkLimits(minAmount, minCost, ask),
  //     minAmount2: minCost,
  //     fee
  //   });

  //   return this.pairs[pair];
  // }

}