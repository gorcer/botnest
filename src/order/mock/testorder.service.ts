import { Injectable } from '@nestjs/common';
import { CreateOrderDto } from '../dto/create-order.dto';
import { UpdateOrderDto } from '../dto/update-order.dto';
import { Order, OrderSideEnum } from '../entities/order.entity';
import { updateModel } from '../../helpers/helpers';
const { add,divide } = require('js-big-decimal');

@Injectable()
export class TestOrderService {

  orders={};
  
  constructor(    
  ) {}

  async create(
    createOrderDto: CreateOrderDto
    ) {    
      const order:any = createOrderDto;
      order.id = Object.keys(this.orders).length+1;
      order.isActive = true;
      order.prefilled=0;
      order.filled=0;
      order.profit=0;
      order.createdAtSec = Date.now() / 1000;

      if (!order.side)
        order.side = OrderSideEnum.BUY;

      
      this.orders[order.id] = order;
      return this.orders[order.id];
  }

  findAll(where) {

    if (!where)
      return Object.values(this.orders);

    return Object.values(this.orders).filter((item) => {

        for (const [key, value] of Object.entries(where)) {
          if (item[key] != value) {
            return false;
          }
        }
        return true;

    });
  }

  findOne(where) {
    const orders = this.findAll(where);
    if (orders.length)
      return orders[0];
    else
      return false;
  }

  update(id: number, updateOrderDto: UpdateOrderDto) {
    updateModel(this.orders[id], updateOrderDto);
  }

  async getSumByParentId(parentId:number, attribute: string) {
    const result = Object.values(this.orders).reduce((accumulator, currentValue:CreateOrderDto) => {
      return add(accumulator, (parentId == currentValue.parentId ? currentValue[attribute] : 0));
    }, 0);

    return result;
  }
}
