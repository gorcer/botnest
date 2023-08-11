import { OrderSideEnum } from "../../order/entities/order.entity";
import { RequestSellInfoDto } from "../dto/request-sell-info.dto";

export interface SellStrategyInterface {
    side: OrderSideEnum,
    get():Promise<Array<RequestSellInfoDto>> 
}