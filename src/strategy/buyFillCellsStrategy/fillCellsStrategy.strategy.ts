import { Inject, Injectable } from '@nestjs/common';
import { Order, OrderSideEnum } from '../../order/entities/order.entity';
import { Repository } from 'typeorm';
import { Pair } from '../../exchange/entities/pair.entity';
import { RequestBuyInfoDto } from '../dto/request-buy-info.dto';
import { BuyStrategyInterface } from '../interfaces/buyStrategy.interface';
import { FillCells } from './fillCells.entity';
import { EntityManager } from 'typeorm';
import { Balance } from '../../balance/entities/balance.entity';
import { compareTo, divide, multiply, subtract } from '../../helpers/bc';
import { Account } from '../../user/entities/account.entity';

export class FillCellsStrategy implements BuyStrategyInterface {
  side = OrderSideEnum.BUY;
  repository: Repository<FillCells>;
  static model = FillCells;

  constructor(private readonly entityManager: EntityManager) {
    this.repository = this.entityManager.getRepository(FillCellsStrategy.model);
  }

  static calculateCellSize({
    totalBalance,
    pair,
    orderAmount,
    minRate,
  }): number {
    if (!totalBalance) {
      return 0;
    }

    if (compareTo(pair.minAmount2, orderAmount) > 0) {
      orderAmount = pair.minAmount2;
    }

    const diffRate = subtract(pair.sellRate, minRate);
    const maxOrderCnt = Math.floor(divide(totalBalance, orderAmount));
    let cellSize = divide(diffRate, maxOrderCnt);

    if (cellSize <= 0) {
      cellSize = multiply(pair.sellRate, 0.01);
    }

    return cellSize;
  }

  get(waitSeconds = 3): Promise<Array<RequestBuyInfoDto>> {
    return this.repository
      .createQueryBuilder('strategy')
      .innerJoin(Pair, 'pair', 'strategy."pairId" = pair.id')
      .innerJoin(Account, 'account', 'strategy."accountId" = account.id')
      .innerJoin(
        Balance,
        'balance',
        'strategy."accountId" = balance."account_id" and balance.currency = pair.currency2',
      )
      .leftJoin(
        Order,
        'order',
        `
                    "order"."accountId" = "balance"."account_id" and
                    "order".currency2 = "balance".currency and 
                    "order"."isActive" = true and
                    abs("order".rate - "pair"."sellRate") < "strategy"."cellSize"
                    `,
      )
      .where('"order".id is null')
      .andWhere(
        `pair.updatedAt > CURRENT_TIMESTAMP - interval '${waitSeconds} seconds'`,
      )
      .andWhere(`"balance".available > "pair"."minAmount2"`)
      .andWhere(`"balance".available > strategy."orderAmount"`)
      .andWhere(`"pair"."isActive" = true`)
      .andWhere(`"account"."is_trading_allowed" = true`)
      .andWhere(`"account"."isActive" = true`)
      .andWhere(`"account"."is_connected" = true`)
      .andWhere(`"strategy"."cellSize" > 0`)
      .andWhere(`"strategy"."isActive" = true`)
      .select(
        `       distinct
                "balance"."account_id" as "accountId",
                "pair"."sellRate" as "rate",
                GREATEST(cast(strategy."orderAmount" as DECIMAL), "pair"."minAmount2") as amount2,
                "pair".id as "pairId"
                `,
      )
      .getRawMany();
  }
}
