import { Injectable } from '@nestjs/common';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Order, OrderSideEnum } from './entities/order.entity';
import { Repository } from 'typeorm';
import { SEC_IN_YEAR } from '../helpers/helpers';
import { Pair } from '../exchange/entities/pair.entity';

@Injectable()
export class OrderService {
  constructor(
    @InjectRepository(Order)
    private ordersRepository: Repository<Order>,
  ) {}

  async create(createOrderDto: CreateOrderDto): Promise<Order> {
    const order = this.ordersRepository.create(createOrderDto);
    return await this.ordersRepository.save(order);
  }

  findAll(where?) {
    return this.ordersRepository.findBy(where);
  }

  getLastOrder(accountId: number) {
    return this.ordersRepository.findOne({
      where: {
        accountId,
      },
      order: {
        id: 'DESC',
      },
    });
  }

  findOne(where) {
    return this.ordersRepository.findOneBy(where);
  }

  update(id: number, updateOrderDto: UpdateOrderDto) {
    return this.ordersRepository.update({ id }, updateOrderDto);
  }

  remove(id: number) {
    return `This action removes a #${id} order`;
  }

  async getActiveOrders(): Promise<Array<Order>> {
    return await this.ordersRepository
      .createQueryBuilder('order')
      .where(`"order".side = :side`, { side: OrderSideEnum.BUY })
      .andWhere('"order"."isActive" = true')
      .andWhere('"order"."prefilled" < "order"."amount1"')
      .getMany();
  }

  async getSumByParentId(parentId: number, attribute: string): Promise<number> {
    const result = await this.ordersRepository
      .createQueryBuilder('order')
      .select(`SUM(${attribute}) as sum`)
      .where({ parentId })
      .getRawOne();

    return result.sum;
  }

  async getActiveOrdersSum(
    accountId: number,
    currency1: string,
    attribute: string,
  ): Promise<number> {
    const result = await this.ordersRepository
      .createQueryBuilder('order')
      .select(`SUM(${attribute}) as sum`)
      .where({ currency1, accountId })
      .andWhere('"order"."isActive" = true')
      .andWhere('"order"."prefilled" < "order"."amount1"')
      .getRawOne();

    return result.sum;
  }
}
