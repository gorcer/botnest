export class RateDto {
  bid: number;
  ask: number;
}

export class PairRatesDto {
  [pairName: string]: RateDto;
}

export class ExchangePairRatesDto {
  [exchangeId: number]: PairRatesDto;
}
