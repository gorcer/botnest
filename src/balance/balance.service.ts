import { Injectable } from "@nestjs/common";
import { BalancesDto } from "./dto/balances.dto";
import { InjectRepository } from "@nestjs/typeorm";
import { Balance } from "./entities/balance.entity";
import { Repository } from "typeorm";
import { lock } from "../helpers";
const { compareTo } = require("js-big-decimal");

const { multiply, add } = require( "js-big-decimal" );

@Injectable()
export class BalanceService {
    
    balances: BalancesDto;

    constructor(
        @InjectRepository(Balance)
        private balanceRepository: Repository<Balance>
      ) {}

    public async set(balances:BalancesDto) {

        return await lock.acquire('Balance', async ()=>{
            this.balances = balances;

            for (const [currency, amount] of Object.entries(this.balances)) {
                    let balance = await this.balanceRepository.findOneBy({
                        currency,                    
                    });
                    if (!balance) {
                        balance = await this.balanceRepository.create({
                            currency,                   
                            amount
                        });                    
                    } else {

                        if (compareTo(balance.amount, amount) !=0) {
                            console.log('Balance discrepancy', currency, 'Need:', balance.amount, 'Reel:', amount);
                        }
                        balance.amount = amount;                    
                    }
                    await this.balanceRepository.save(balance);
            }
        });

    }


    public async getBalanceAmount(currency: string) {
        let balance = await this.balanceRepository.findOneBy({
            currency,                    
        });
        if (balance) {
            return balance.amount;
        } else {
            return 0;
        }
    }

    public async income(currency:string, amount:number) {
        let balance = await this.balanceRepository.findOneBy({
            currency,                    
        });
        if (balance) {
            balance.amount = add(balance.amount, amount);
        }
        await this.balanceRepository.save(balance);
        return balance;
    }

    public async outcome(currency:string, amount:number) {
        return this.income(currency, multiply(-1, amount));
    }


}