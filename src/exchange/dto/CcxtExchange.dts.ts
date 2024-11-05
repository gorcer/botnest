import { Exchange } from '../entities/exchange.entity';
import { Exchange as CcxtExchange } from 'ccxt';

export class CcxtExchangeDto extends CcxtExchange {
  account_id: number;
  exchange_id: number;
  exchange: Exchange;
}
