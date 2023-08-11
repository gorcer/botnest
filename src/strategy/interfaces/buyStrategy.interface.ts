import { OrderSideEnum } from "../../order/entities/order.entity";
import { RequestBuyInfoDto } from "../dto/request-buy-info.dto";

export interface BuyStrategyInterface {
    side: OrderSideEnum,
    get():Promise<Array<RequestBuyInfoDto>> 
}