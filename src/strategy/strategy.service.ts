import { Inject, Injectable } from "@nestjs/common";
import { EntityManager } from 'typeorm';
import { updateModel } from "../helpers";
import { FillCellsStrategy } from "./buyFillCellsStrategy/fillCellsStrategy.strategy";
import { StrategyInterface } from "./interfaces/strategy.interface";
import { AwaitProfitStrategy } from "./sellAwaitProfitStrategy/awaitProfitStrategy.strategy";


@Injectable()
export class StrategyService {

    exchanges = {};
    accounts = {};

    constructor(
        @Inject(EntityManager) 
        private readonly entityManager: EntityManager,        
    ) {
    }

    getStrategy(strategyService:any) {        
        return new strategyService(this.entityManager);
    }

    async setStrategyForAccount(where:any, strategyService:any, config: any) {        
            
        const strategyRepository = this.entityManager.getRepository(strategyService.model);
    
        let strategyItem = await strategyRepository.findOne({ where });
        if (!strategyItem) {
            strategyItem = strategyRepository.create({...where, ...config })           
        } else {
            updateModel(strategyItem, config);
        }
        await strategyRepository.save(
            strategyItem
        );
    }
}