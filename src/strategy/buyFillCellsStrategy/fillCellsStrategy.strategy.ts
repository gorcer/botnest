import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Order, OrderSideEnum } from "../../order/entities/order.entity";
import { Repository } from "typeorm";
import { SEC_IN_YEAR } from "../../helpers";
import { Pair } from "../../exchange/entities/pair.entity";
import { Balance } from "../../balance/entities/balance.entity";
import { RequestBuyInfoDto } from "../dto/request-buy-info.dto";
import { BuyStrategyInterface } from "../interfaces/buyStrategy.interface";
import { FillCells } from "./fillCells.entity";

const { multiply, compareTo, subtract, add, divide } = require('js-big-decimal');


@Injectable()
export class FillCellsStrategy implements BuyStrategyInterface {

    side = OrderSideEnum.BUY;

    constructor(
        @InjectRepository(Balance)
        private balanceRepository: Repository<Balance>
    ) { }

    prepareAttributes({balance, pair, orderAmount}) {

        if (compareTo(orderAmount, pair.minAmount1)<0) {
            orderAmount = pair.minAmount1;
        }

        const totalBalance = add(balance.amount, balance.inOrders);
        const diffRate = subtract(pair.sellRate, pair.historicalMinRate);
        const maxOrderCnt = Math.floor(divide(totalBalance, multiply(orderAmount, pair.sellRate)));

        return {
            orderAmount: orderAmount,
            cellSize: Math.floor(divide(diffRate, maxOrderCnt)),
            pairId: pair.id
        }
    }

    get(): Promise<Array<RequestBuyInfoDto>> {
        return this.balanceRepository
            .createQueryBuilder("balance")
            .innerJoin(Pair, 'pair', 'pair.currency2 = "balance".currency')
            .innerJoin(FillCells, 'strategy', 'strategy."accountId" = balance."accountId"')
            .leftJoin(Order, 'order', `
                    "order"."accountId" = "balance"."accountId" and
                    "order".currency2 = "balance".currency and 
                    "order"."isActive" = true and
                    "order"."prefilled" < "order"."amount1" and
                    "order".rate >= (("pair"."sellRate" / strategy.cellSize)::int * strategy.cellSize ) and 
                    "order".rate < ((("pair"."sellRate" / strategy.cellSize)::int + 1) * strategy.cellSize)`
                )
            .where('"order".id is null')
            .andWhere(`pair.updatedAt > CURRENT_TIMESTAMP - interval '10 seconds'`)
            .andWhere(`"balance".amount > "pair"."minAmount2"`)
            .andWhere(`"balance".amount > strategy."orderAmount" * "pair"."sellRate"`)
            .andWhere(`"pair"."isActive" = true`)
            .select(`
                "balance"."accountId",
                "pair"."sellRate" as "rate",
                GREATEST(cast(strategy."orderAmount" as DECIMAL), "pair"."minAmount1") as amount1,
                "pair".id as "pairId",
                "pair".name as "pairName"
                `)
            .getRawMany();
    }

}