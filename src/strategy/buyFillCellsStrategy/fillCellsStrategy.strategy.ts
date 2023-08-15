import { Inject, Injectable } from "@nestjs/common";
import { Order, OrderSideEnum } from "../../order/entities/order.entity";
import { Repository } from "typeorm";
import { Pair } from "../../exchange/entities/pair.entity";
import { RequestBuyInfoDto } from "../dto/request-buy-info.dto";
import { BuyStrategyInterface } from "../interfaces/buyStrategy.interface";
import { FillCells } from "./fillCells.entity";
import { EntityManager } from 'typeorm';
import { Balance } from "../../balance/entities/balance.entity";



const { multiply, compareTo, subtract, add, divide } = require('js-big-decimal');


export class FillCellsStrategy implements BuyStrategyInterface {

    side = OrderSideEnum.BUY;
    repository:Repository<FillCells>;
    static model = FillCells;
    
    constructor(              
        private readonly entityManager: EntityManager,
    ) { 
        this.repository = this.entityManager.getRepository(FillCellsStrategy.model);
    }

    static calculateCellSize({balance, pair, orderAmount, risk}) {

        if (compareTo(pair.minAmount1, orderAmount) > 0 ) {
            orderAmount = pair.minAmount1;
        }

        const totalBalance = balance.amount;
        const diffRate = subtract(pair.sellRate, pair.historicalMinRate);
        const maxOrderCnt = Math.floor(divide(totalBalance, multiply(orderAmount, pair.sellRate)));
        let cellSize = divide(diffRate, maxOrderCnt);
        if (risk != undefined) {
            if (risk > 99)
                risk = 99;

            cellSize = multiply(cellSize, (1 - risk / 100));
        }

        if (cellSize == 0) {
            cellSize = multiply(pair.sellRate, 0.01);
        }

        return cellSize;
    }


    get(waitSeconds=3): Promise<Array<RequestBuyInfoDto>> {

        return this.repository
            .createQueryBuilder()
            .from(FillCells, 'strategy')            
            .innerJoin(Balance, 'balance', 'strategy."accountId" = balance."accountId"')
            .innerJoin(Pair, 'pair', 'pair.currency2 = "balance".currency and strategy."pairId" = pair.id')
            .leftJoin(Order, 'order', `
                    "order"."accountId" = "balance"."accountId" and
                    "order".currency2 = "balance".currency and 
                    "order"."isActive" = true and
                    "order"."prefilled" < "order"."amount1" and
                    "order".rate >= (("pair"."sellRate" / strategy.cellSize)::int * strategy.cellSize ) and 
                    "order".rate < ((("pair"."sellRate" / strategy.cellSize)::int + 1) * strategy.cellSize)`
                )
            .where('"order".id is null')
            .andWhere(`pair.updatedAt > CURRENT_TIMESTAMP - interval '${waitSeconds} seconds'`)
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