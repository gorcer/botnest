import { PartialType } from '@nestjs/mapped-types';
import { CreateOrderDto } from './create-order.dto';

export class UpdateOrderDto extends PartialType(CreateOrderDto) {
    isActive?: boolean;
    filled?: number;
    prefilled?:number;
    profit?:number;
    profitPc?:number;
}
