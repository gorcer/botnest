import { OrderSideEnum } from "../../order/entities/order.entity";
import { RequestBuyInfoDto } from "../dto/request-buy-info.dto";

export interface BuyStrategyInterface {
    side: OrderSideEnum,

    prepareAttributes(config:object),
    get():Promise<Array<RequestBuyInfoDto>> 
}