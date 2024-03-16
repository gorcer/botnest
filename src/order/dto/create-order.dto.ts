import { OrderSideEnum } from "../entities/order.entity";

export class CreateOrderDto {    
    extOrderId: string;
    rate: number;
    expectedRate: number
    amount1: number;
    amount2: number;
    amount2_in_usd: number;
    fee?: number;
    fee1?: number;
    fee2?: number;
    fee_in_usd?: number;
    parentId?: number;
    side?: OrderSideEnum;    
    pairName: string;
    accountId: number;
    pairId: number;  
    currency1: string;  
    currency2: string;  
    createdAtSec:number;
}

