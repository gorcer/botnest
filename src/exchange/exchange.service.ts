import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Exchange } from './entities/exchange.entity';
import { MoreThan, Repository } from 'typeorm';
import { ApiService } from './api.service';

@Injectable()
export class ExchangeService {
  apis = {};

  constructor(
    private apiService: ApiService,
    @InjectRepository(Exchange)
    private exchangeRepository: Repository<Exchange>,
  ) {}

  public async getApiForExchange(exchange: Exchange) {
    this.apis[exchange.id] =
      this.apis[exchange.id] ||
      (await this.apiService.getApi(
        exchange.exchange_name,
        '',
        '',
        '',
        exchange.test_mode,
      ));
    this.apis[exchange.id].exchange_id = exchange.id;
    return this.apis[exchange.id];
  }

  public async getAllActive(): Promise<Exchange[]> {
    return await this.exchangeRepository.find({
      where: {
        is_active: true,
        accounts_count: MoreThan(0),
      },
      relations: ['pairs'],
    });
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
