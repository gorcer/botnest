import { Inject, Injectable } from "@nestjs/common";
import { EntityManager } from 'typeorm';
import { updateModel } from "../helpers";
import { FillCells } from "./buyFillCellsStrategy/fillCells.entity";
import { FillCellsStrategy } from "./buyFillCellsStrategy/fillCellsStrategy.strategy";
import { BuyStrategyInterface } from "./interfaces/buyStrategy.interface";
import { SellStrategyInterface } from "./interfaces/sellStrategy.interface";
import { AwaitProfit } from "./sellAwaitProfitStrategy/awaitProfit.entity";
import { AwaitProfitStrategy } from "./sellAwaitProfitStrategy/awaitProfitStrategy.strategy";


@Injectable()
export class StrategyService {

    exchanges = {};
    accounts = {};

    constructor(
        @Inject(EntityManager) 
        private readonly entityManager: EntityManager,
        private strategyFillCells: FillCellsStrategy,
        private strategyAwaitProfit: AwaitProfitStrategy,
    ) {
    }

    getStrategy(strategyName) {
        if (!this[`strategy${strategyName}`]) {
            throw new Error('Unknown strategy '+strategyName);
        }
        return this[`strategy${strategyName}`];
    }

    async setStrategyForAccount(accountId:number, strategyModel:any, config: any) {        
        const strategyRepository = this.entityManager.getRepository(strategyModel);

        const service = this.getStrategy(strategyModel.name);
        config = service.prepareAttributes(config);

        let strategy = await strategyRepository.findOne({ where: { accountId } });
        if (!strategy) {
            strategy = strategyRepository.create({...{accountId}, ...config })           
        } else {
            updateModel(strategy, config);
        }
        await strategyRepository.save(
            strategy
        );
    }
}