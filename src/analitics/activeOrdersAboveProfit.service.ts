import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Order, OrderSideEnum } from "../order/entities/order.entity";
import { Repository } from "typeorm";
import { SEC_IN_YEAR } from "../helpers";
import { Pair } from "../exchange/entities/pair.entity";

const { add, divide } = require('js-big-decimal');

@Injectable()
export class ActiveOrdersAboveProfit {

  constructor(
    @InjectRepository(Order)
    private ordersRepository: Repository<Order>
  ) { }


  async get(dailyProfit: number, yerlyProfit: number): Promise<any> {

    const profitPerSecDaily = divide(dailyProfit, SEC_IN_YEAR, 15);
    const profitPerSecYerly = divide(yerlyProfit, SEC_IN_YEAR, 15);
    const secondsInDay = 24 * 60 * 60;
    const now = Math.floor(Date.now() / 1000);

    return await this.ordersRepository
      .createQueryBuilder("order")
      .innerJoinAndSelect(Pair, 'pair', 'pair.currency1 = "order".currency1 AND pair.currency2 = "order".currency2')
      .andWhere(`
      100*((("pair"."buyRate" * "order".amount1*(1-pair.fee)) / ("order".amount2 + "order".fee))-1) >= 
        case 
          when 
            (extract(epoch from now()) - "order"."createdAtSec") < ${secondsInDay}
          then  
            ( ${profitPerSecDaily} * (extract(epoch from now()) - "order"."createdAtSec") )
          else  
            ( ${profitPerSecYerly} * (extract(epoch from now()) - "order"."createdAtSec") )
        end        
        `) // Calculate annual profitability
      .andWhere(`"order".side = :side`, { side: OrderSideEnum.BUY })
      .andWhere(`"order".rate < "pair"."buyRate"`)
      .andWhere(`"order"."createdAtSec" < extract(epoch from now())+1`)
      .andWhere('"order"."isActive" = true')
      .andWhere('"order"."prefilled" < "order"."amount1"')
      .select(`
          "order".*,
          "pair"."buyRate" as "buyRate"
      `)
      .getRawMany();

  }

}