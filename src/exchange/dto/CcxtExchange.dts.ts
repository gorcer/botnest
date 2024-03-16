import { Exchange } from 'ccxt';

export class CcxtExchangeDto extends Exchange {
  account_id: number;
  exchange_id: number;
}
