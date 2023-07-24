import { Injectable } from '@nestjs/common';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Order, OrderType } from './entities/order.entity';
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

  findAll() {
    return `This action returns all order`;
  }

  findOne(id: number) {
    return `This action returns a #${id} order`;
  }

  update(id: number, updateOrderDto: UpdateOrderDto) {
    return `This action updates a #${id} order`;
  }

  remove(id: number) {
    return `This action removes a #${id} order`;
  }

  async getActiveOrdersAboveProfit(currentRate: number, dailyProfit:number, yerlyProfit:number): Promise<Array<Order>> {

    const profitPerSecDaily = parseFloat(divide(dailyProfit , 365 * 24 * 60 * 60, 15));
    const profitPerSecYerly = parseFloat(divide(yerlyProfit , 365 * 24 * 60 * 60, 15));
    const secondsInDay = 24 * 60 * 60;
    const now = Math.floor(Date.now() / 1000);

    return await this.ordersRepository
    .createQueryBuilder("order")
    .where("order.type = :type", { type: OrderType.BUY })
    .andWhere(`(${currentRate} / order.rate)-1 >= 
        case 
          when 
            (${now} - "order"."createdAtSec") < ${secondsInDay}
          then  
            ( ${profitPerSecDaily} * (${now} - "order"."createdAtSec") )
          else  
            ( ${profitPerSecYerly} * (${now} - "order"."createdAtSec") )
        end        
        `) // Calculate annual profitability
    .andWhere(`order.rate < ${currentRate}`)
    .andWhere(`(${now} - "order"."createdAtSec")>1`)    
    .getMany();

  }
}
