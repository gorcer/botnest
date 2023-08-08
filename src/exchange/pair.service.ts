import { Injectable } from "@nestjs/common";
import { elapsedSecondsFrom, lock } from "../helpers";
import { PublicApiService } from "./publicApi.service";
import { InjectRepository } from "@nestjs/typeorm";
import { Pair } from "./entities/pair.entity";
import { Repository } from "typeorm";

@Injectable()
export class PairService  {

  pairs:{ [id: string]: Pair }={};
  lastRequestTime={};  
  FETCH_TIMEOUT;

  constructor(
    public publicApi: PublicApiService,
    @InjectRepository(Pair)
    private pairRepository: Repository<Pair>
  ) {    
    this.FETCH_TIMEOUT = Number(process.env.EXCHANGE_RATES_FETCH_TIMEOUT);
  }

  async fetchOrCreatePair(currency1: string, currency2: string): Promise<Pair> {
    let pair = await this.pairRepository.findOneBy({currency1, currency2});
    if (!pair) {
      pair = this.pairRepository.create({currency1, currency2})
      await this.pairRepository.save(
        pair
      );
      const pairTitle = currency1 + '/' + currency2;
      this.lastRequestTime[pairTitle] = 1;
    }
    return pair;
  }

  async getOrRefreshPair(currency1: string, currency2: string):Promise<Pair> {

    const pair = currency1 + '/' + currency2;
    if (!this.pairs[pair]) {
      this.pairs[pair] = await this.fetchOrCreatePair(currency1, currency2);
    }

    if (!this.lastRequestTime[pair]) {
      this.lastRequestTime[pair] = 1;
    }


    if ( elapsedSecondsFrom(this.FETCH_TIMEOUT, this.lastRequestTime[pair]) ) {

      await lock.acquire('requestLastPair ' + pair, async () => {

        if ( !elapsedSecondsFrom(this.FETCH_TIMEOUT, this.lastRequestTime[pair])) {
          return this.pairs[pair];
        }

        this.lastRequestTime[pair] = Date.now()/1000;
        await this.refreshPairInfo(currency1, currency2);

      });

    }

    return this.pairs[pair];
  }

  public async refreshPairInfo(currency1: string, currency2: string) {
    const pair = currency1 + '/' + currency2;

    const lastPrice = await this.publicApi.getLastPrice(pair);
    const {bid, ask} = await this.publicApi.getActualRates(pair);

    this.pairs[pair].lastPrice = lastPrice;
    this.pairs[pair].buyRate = bid;
    this.pairs[pair].sellRate = ask;

    await this.pairRepository.save(
      this.pairs[pair]
    );

    return this.pairs[pair];
  }

}