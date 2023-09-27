import { Injectable } from '@nestjs/common';
import {
  checkLimits,
  elapsedSecondsFrom,
  extractCurrency,
  lock,
  updateModel,
} from '../helpers/helpers';
import { InjectRepository } from '@nestjs/typeorm';
import { Exchange } from './entities/exchange.entity';
import { MoreThan, Repository } from 'typeorm';
import { PublicApiService } from './publicApi.service';

@Injectable()
export class ExchangeService {
  apis = {};

  constructor(
    @InjectRepository(Exchange)
    private exchangeRepository: Repository<Exchange>,
  ) { }

  public getApiForExchange(exchange: Exchange): PublicApiService {
    this.apis[exchange.id] =
      this.apis[exchange.id] ||
      new PublicApiService(exchange.exchange_name, exchange.test_mode);
    return this.apis[exchange.id];
  }

  public async getAllActive(): Promise<Exchange[]> {
    return await this.exchangeRepository.find(
      { 
        where: { 
          is_active: true,
          accounts_count: MoreThan(0)
        },
        relations: ['pairs']

      }
      );
  }

  public async fetchOrCreate(
    title: string,
    test_mode: boolean,
  ): Promise<Exchange> {
    let exchange = await this.exchangeRepository.findOneBy({ title });
    if (!exchange) {
      const opt = { title, exchange_name: title, test_mode };
      exchange = this.exchangeRepository.create(opt);
      await this.exchangeRepository.save(exchange);
    }
    return exchange;
  }
}
