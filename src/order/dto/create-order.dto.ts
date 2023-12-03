import { OrderSideEnum } from "../entities/order.entity";

export class CreateOrderDto {    
    extOrderId: string;
    rate: number;
    expectedRate: number
    amount1: number;
    amount2: number;
    fee?: number;
    fee1?: number;
    fee2?: number;
    parentId?: number;
    side?: OrderSideEnum;    
    pairName: string;
    accountId: number;
    pairId: number;  
    currency1: string;  
    currency2: string;  
    createdAtSec:number;
}

