import { OrderSideEnum } from "../../order/entities/order.entity";
import { BaseStrategyModel } from "../baseStrategyModel.entity";


export interface StrategyInterface {
    side: OrderSideEnum,   
    model?:typeof BaseStrategyModel;   
}