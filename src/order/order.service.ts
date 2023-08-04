import { Injectable } from '@nestjs/common';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Order, OrderSideEnum } from './entities/order.entity';
import { Repository } from 'typeorm';
const { divide } = require('js-big-decimal');

@Injectable()
export class OrderService {

  constructor(
    @InjectRepository(Order)
    private ordersRepository: Repository<Order>
  ) {}

  async create(
    createOrderDto: CreateOrderDto
    ):Promise<Order> {
     const order = this.ordersRepository.create(createOrderDto);
     return await this.ordersRepository.save(order);
  }

  findAll(where) {
    return this.ordersRepository.findBy(where);
  }

  findOne(where) {
    return this.ordersRepository.findOneBy(where);
  }

  update(id: number, updateOrderDto: UpdateOrderDto) {
    return this.ordersRepository.update({id}, updateOrderDto);
  }

  remove(id: number) {
    return `This action removes a #${id} order`;
  }

  async getActiveOrdersAboveProfit(currency1:string, currency2:string, currentRate: number, dailyProfit:number, yerlyProfit:number): Promise<Array<Order>> {

    const profitPerSecDaily = divide(dailyProfit , 365 * 24 * 60 * 60, 15);
    const profitPerSecYerly = divide(yerlyProfit , 365 * 24 * 60 * 60, 15);
    const secondsInDay = 24 * 60 * 60;
    const now = Math.floor(Date.now() / 1000);
  
    return await this.ordersRepository
    .createQueryBuilder("order")    
    .where(`100*((${currentRate} / order.rate)-1) >= 
        case 
          when 
            (${now} - "order"."createdAtSec") < ${secondsInDay}
          then  
            ( ${profitPerSecDaily} * (${now} - "order"."createdAtSec") )
          else  
            ( ${profitPerSecYerly} * (${now} - "order"."createdAtSec") )
        end        
        `) // Calculate annual profitability
    .andWhere(`"order".currency1 = :currency1`, { currency1 })
    .andWhere(`"order".currency2 = :currency1`, { currency2 })
    .andWhere(`"order".side = :side`, { side: OrderSideEnum.BUY })
    .andWhere(`"order".rate < ${currentRate}`)
    .andWhere(`"order"."createdAtSec" < ${(now+1)}`)    
    .andWhere('"order"."isActive" = true')
    .andWhere('"order"."prefilled" < "order"."amount1"')   
    .getMany();

  }

  async getSumByParentId(parentId, attribute: string) {
    const result = await this.ordersRepository
    .createQueryBuilder("order")
    .select(`SUM(${attribute}) as sum`)
    .where({parentId})    
    .getRawOne();

    return result.sum;
  }
}
