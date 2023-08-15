import { OrderSideEnum } from "../../order/entities/order.entity";
import { RequestSellInfoDto } from "../dto/request-sell-info.dto";
import { StrategyInterface } from "./strategy.interface";

export interface SellStrategyInterface extends StrategyInterface {  

    get():Promise<Array<RequestSellInfoDto>> 
}