import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Order, OrderSideEnum } from "../../order/entities/order.entity";
import { Repository } from "typeorm";
import { SEC_IN_DAY, SEC_IN_YEAR } from "../../helpers";
import { Pair } from "../../exchange/entities/pair.entity";
import { RequestSellInfoDto } from "../dto/request-sell-info.dto";
import { AwaitProfit } from "./awaitProfit.entity";
import { SellStrategyInterface } from "../interfaces/sellStrategy.interface";

const { add, divide } = require('js-big-decimal');

@Injectable()
export class AwaitProfitStrategy implements SellStrategyInterface {

  side = OrderSideEnum.SELL;

  constructor(
    @InjectRepository(Order)
    private ordersRepository: Repository<Order>
  ) { }

  prepareAttributes(config) {
    return config;
  }

  async get(now?): Promise<Array<RequestSellInfoDto>> {

    if (!now)
      now = "extract(epoch from now())"; 

    return await this.ordersRepository
      .createQueryBuilder("order")
      .innerJoin(AwaitProfit, 'strategy', 'strategy."accountId" = "order"."accountId"')
      .innerJoinAndSelect(Pair, 'pair', 'pair.id = "order"."pairId"')
      .andWhere(`
      100*((("pair"."buyRate" * "order".amount1 * (1-pair.fee)) / ("order".amount2 + "order".fee))-1) >= 
        case 
          when 
            (${now} - "order"."createdAtSec") < ${SEC_IN_DAY}
          then  
            ( (strategy.minDailyProfit / ${SEC_IN_YEAR}) * (${now} - "order"."createdAtSec") )
          else  
            ( (strategy.minYerlyProfit / ${SEC_IN_YEAR}) * (${now} - "order"."createdAtSec") )
        end        
        `)
      .andWhere(`"order".side = :side`, { side: OrderSideEnum.BUY })
      .andWhere(`"order".rate < "pair"."buyRate"`)
      .andWhere(`"order"."createdAtSec" < ${now}+1`)
      .andWhere('"order"."isActive" = true')
      .andWhere('"order"."prefilled" < "order"."amount1"')
      .select(`
          "order"."pairName",
          "order"."id",
          "order"."prefilled",
          "order"."accountId",
          "order"."amount1" - "order"."prefilled" as "needSell",
          "pair".id as "pairId",
          "pair"."buyRate" as "buyRate"
      `)
      .getRawMany();

  }

}