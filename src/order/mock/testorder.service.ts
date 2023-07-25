import { Injectable } from '@nestjs/common';
import { CreateOrderDto } from '../dto/create-order.dto';
import { UpdateOrderDto } from '../dto/update-order.dto';
import { Order } from '../entities/order.entity';
const { divide } = require('js-big-decimal');

@Injectable()
export class TestOrderService {

  orders=[];
  

  constructor(    
  ) {}

  async create(
    createOrderDto: CreateOrderDto
    ) {    
      const order:any = createOrderDto;
      order.id = this.orders.length+1;
      
      this.orders.push(createOrderDto);
      return createOrderDto;
  }

  findAll(where) {
    return this.orders;
  }

  findOne(where) {
    return this.orders[0];
  }

  update(id: number, updateOrderDto: UpdateOrderDto) {
    this.orders[id] = {...this.orders[id], ...updateOrderDto};
  }


  async getActiveOrdersAboveProfit(currentRate: number, dailyProfit:number, yerlyProfit:number): Promise<Array<Order>> {
      return this.orders;
  }

  async getSumByParentId(parentId:number, attribute: string) {
    const result = this.orders.reduce((accumulator, currentValue) => {
      return accumulator + (parentId == currentValue.parentId ? currentValue[attribute] : 0);
    })

    return result;
  }
}
