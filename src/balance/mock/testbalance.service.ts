import { Injectable } from "@nestjs/common";
import { BalancesDto } from "../dto/balances.dto";
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

    public async income(accountId, currency:string, amount:number) {
        this.balances[currency] = add(this.balances[currency], amount);
        return this.balances[currency];
    }

    public async outcome(accountId, currency:string, amount:number) {
        return this.income(accountId, currency, multiply(-1, amount));
    }

    public async loadBalancesAmount(accountId)  {

    }


}