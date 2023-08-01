import { OrderType } from "../entities/order.entity";


export class CreateOrderDto {    
    extOrderId: string;
    rate: number;
    expectedRate: number
    amount1: number;
    amount2: number;
    fee?: number;
    parentId?: number;
    type?: OrderType
}
