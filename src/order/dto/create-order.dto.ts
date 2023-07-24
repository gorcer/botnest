import { Double } from "typeorm";

export class CreateOrderDto {    
    extOrderId: string;
    rate: number;
    expectedRate: number
    amount1: number;
    amount2: number;
    parentId?: number;
}
