import { Injectable } from "@nestjs/common";
import { BalancesDto } from "../dto/balances.dto";
const { compareTo } = require("js-big-decimal");

const { multiply, add } = require( "js-big-decimal" );

@Injectable()
export class TestBalanceService {
    
    balances: BalancesDto;

    constructor(        
      ) {}

    public async set(balances:BalancesDto) {

        this.balances = balances;

    }


    public async getBalanceAmount(currency: string) {
        return this.balances[currency];
    }

    public async income(currency:string, amount:number) {
        this.balances[currency] = add(this.balances[currency], amount);
        return this.balances[currency];
    }

    public async outcome(currency:string, amount:number) {
        return this.income(currency, multiply(-1, amount));
    }


}