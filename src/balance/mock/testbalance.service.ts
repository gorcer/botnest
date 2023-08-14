import { Injectable } from "@nestjs/common";
import { BalancesDto } from "../dto/balances.dto";
import { OperationType } from "../entities/balanceLog.entity";
const { compareTo } = require("js-big-decimal");
const { multiply, add } = require( "js-big-decimal" );

@Injectable()
export class TestBalanceService {
    
    balances: BalancesDto;

    constructor(        
      ) {}

    public async set(accountId, balances:BalancesDto) {
        this.balances = balances;
    }

    public async getBalanceAmount(accountId, currency: string) {
        return this.balances[currency];
    }

    public async income(accountId: number, currency: string, sourceId:number, operationType: OperationType, amount: number) {
        this.balances[currency] = add(this.balances[currency], amount);
        return this.balances[currency];
    }

    public async outcome(accountId: number, currency: string, sourceId:number, operationType: OperationType, amount: number) {
        return this.income(accountId, currency,sourceId,operationType, multiply(-1, amount));
    }

    public async loadBalancesAmount(accountId)  {

    }


}