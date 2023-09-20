import { Injectable } from "@nestjs/common";
import { checkLimits, elapsedSecondsFrom, extractCurrency, lock, updateModel } from "../helpers/helpers";
import { InjectRepository } from "@nestjs/typeorm";
import { Exchange } from "./entities/exchange.entity";
import { Repository } from "typeorm";
import { PublicApiService } from "./publicApi.service";

@Injectable()
export class ExchangeService {

  apis={};

  constructor(
    @InjectRepository(Exchange)
    private exchangeRepository: Repository<Exchange>
  ) { }

  public getApiForExchange(exchange: Exchange) {    
    this.apis[exchange.id] = this.apis[exchange.id] || (new PublicApiService(exchange.exchange_name, exchange.test_mode));
    return this.apis[exchange.id];
  }

  public async getAllActive(): Promise<Exchange[]> {
    let exchange = await this.exchangeRepository.findBy({ is_active: true });
    return exchange;
  }

  public async findOne(alias: string): Promise<Exchange> {
    let exchange = await this.exchangeRepository.findOneBy({ alias });
    return exchange;
  }

  public async fetchOrCreate(alias: string, test_mode:boolean): Promise<Exchange> {
    let exchange = await this.exchangeRepository.findOneBy({ alias });
    if (!exchange) {
      const opt = { alias,title: alias, exchange_name:alias, test_mode };
      exchange = this.exchangeRepository.create(opt);
      await this.exchangeRepository.save(
        exchange
      );      
    }
    return exchange;
  }

}