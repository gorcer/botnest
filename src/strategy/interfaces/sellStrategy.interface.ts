import { OrderSideEnum } from "../../order/entities/order.entity";
import { RequestSellInfoDto } from "../dto/request-sell-info.dto";

export interface SellStrategyInterface {
    side: OrderSideEnum,

    prepareAttributes(config:object),
    get():Promise<Array<RequestSellInfoDto>> 
}