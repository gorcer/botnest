import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Order, OrderSideEnum } from "../order/entities/order.entity";
import { Repository } from "typeorm";
import { SEC_IN_YEAR } from "../helpers";
import { Pair } from "../exchange/entities/pair.entity";
import { Balance } from "../balance/entities/balance.entity";

const { add, divide } = require('js-big-decimal');


@Injectable()
export class AccountsReadyToBuy {

    constructor(
        @InjectRepository(Balance)
        private balanceRepository: Repository<Balance>
    ) { }

    async get(amount1: number, rateMargin: number): Promise<any> {
        return await this.balanceRepository
            .createQueryBuilder("balance")
            .innerJoin(Pair, 'pair', 'pair.currency2 = "balance".currency')
            .leftJoin(Order, 'order', `
                    "order".currency2 = "balance".currency and 
                    "order"."isActive" = true and
                    "order"."prefilled" < "order"."amount1" and
                    "order".rate > "pair"."sellRate" * (1-cast(:rateMargin as decimal)) and 
                    "order".rate < "pair"."sellRate" * (1+cast(:rateMargin as decimal))`,
                { rateMargin })
            .where('"order".id is null')
            .andWhere(`pair.updatedAt > CURRENT_TIMESTAMP - interval '5 seconds'`)
            .andWhere(`"balance".amount > "pair"."minAmount2"`)
            .andWhere(`"balance".amount > :amount1 * "pair"."sellRate"`, { amount1 })
            .andWhere(`"pair"."isActive" = true`)
            .select(`
                "balance"."accountId",
                "pair"."sellRate" as "rate",
                GREATEST(cast(${amount1} as DECIMAL), "pair"."minAmount1") as amount1,
                "pair".currency1,
                "pair".currency2
                `)
            .getRawMany();
    }

}