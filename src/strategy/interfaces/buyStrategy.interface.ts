import { RequestBuyInfoDto } from '../dto/request-buy-info.dto';
import { StrategyInterface } from './strategy.interface';

export interface BuyStrategyInterface extends StrategyInterface {
  get(): Promise<Array<RequestBuyInfoDto>>;
}
