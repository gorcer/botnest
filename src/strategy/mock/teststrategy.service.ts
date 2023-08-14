import { Inject, Injectable } from "@nestjs/common";
import { EntityManager } from 'typeorm';



@Injectable()
export class TestStrategyService {

    exchanges = {};
    accounts = {};

    constructor(                
    ) {
    }

    getStrategy(strategyName) {
       
       
    }

    async setStrategyForAccount(accountId:number, strategyModel:any, config: any) {        
       
    }
}