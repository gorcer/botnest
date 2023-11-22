import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Order, OrderSideEnum } from '../../order/entities/order.entity';
import { Repository } from 'typeorm';
import { SEC_IN_DAY, SEC_IN_YEAR } from '../../helpers/helpers';
import { Pair } from '../../exchange/entities/pair.entity';
import { RequestSellInfoDto } from '../dto/request-sell-info.dto';
import { AwaitProfit } from './awaitProfit.entity';
import { SellStrategyInterface } from '../interfaces/sellStrategy.interface';
import { EntityManager } from 'typeorm';
import { Account } from '../../user/entities/account.entity';
import { Balance } from '../../balance/entities/balance.entity';

export class AwaitProfitStrategy implements SellStrategyInterface {
  side = OrderSideEnum.SELL;
  repository: Repository<AwaitProfit>;
  static model = AwaitProfit;

  constructor(private readonly entityManager: EntityManager) {
    this.repository = this.entityManager.getRepository(
      AwaitProfitStrategy.model,
    );
  }

  async get(now?): Promise<Array<RequestSellInfoDto>> {
    if (!now) now = 'extract(epoch from now())';

    return await this.repository
      .createQueryBuilder('strategy')
      .innerJoin(Order, 'order', 'strategy."accountId" = "order"."accountId"')
      .innerJoin(Pair, 'pair', 'pair.id = "order"."pairId"')
      .innerJoin(Account, 'account', 'strategy."accountId" = account.id')
      .innerJoin(
        Balance,
        'balance',
        'strategy."accountId" = balance."accountId" and balance.currency = pair.currency1',
      )
      .andWhere(
        `
      100*((("pair"."buyRate" * "order".amount1 * (1-pair.fee)) / ("order".amount2 + "order".fee))-1) >= 
        case 
          when 
            (${now} - "order"."createdAtSec") < ${SEC_IN_DAY}
          then  
            ( (strategy.minDailyProfit / ${SEC_IN_YEAR}) * (${now} - "order"."createdAtSec") )
          else  
            ( (strategy.minYerlyProfit / ${SEC_IN_YEAR}) * (${now} - "order"."createdAtSec") )
        end        
        `,
      )
      .andWhere(`"balance".amount >= order.amount1`)
      .andWhere(`"account"."is_trading_allowed" = true`)
      .andWhere(`"account"."isActive" = true`)
      .andWhere(`"order".side = :side`, { side: OrderSideEnum.BUY })
      .andWhere(`"order".rate < "pair"."buyRate"`)
      .andWhere(`"order"."createdAtSec" < ${now}+1`)
      .andWhere('"order"."isActive" = true')
      .andWhere('"strategy"."isActive" = true')
      .andWhere(
        '("strategy"."pairId" is null or "strategy"."pairId" = "pair"."id")',
      )
      .andWhere('"order"."prefilled" < "order"."amount1"')
      .select(
        `
          distinct
          "order"."pairName",
          "order"."id",
          "order"."prefilled",
          "order"."accountId",
          "order"."amount1" - "order"."prefilled" as "needSell",
          "pair".id as "pairId",
          "pair"."buyRate" as "rate"
      `,
      )
      .getRawMany();
  }
}
