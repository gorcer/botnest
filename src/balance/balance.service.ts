import { Injectable } from "@nestjs/common";
import { BalancesDto } from "./dto/balances.dto";
import { InjectRepository } from "@nestjs/typeorm";
import { Balance } from "./entities/balance.entity";
import { Repository } from "typeorm";
import { lock } from "../helpers";
import { FileLogService } from "../log/filelog.service";
const { compareTo } = require("js-big-decimal");

const { multiply, add } = require( "js-big-decimal" );

@Injectable()
export class BalanceService {
    
    balances: BalancesDto = {};

    constructor(
        @InjectRepository(Balance)
        private balanceRepository: Repository<Balance>,
        private log: FileLogService,    

      ) {}

    public async set(balances:BalancesDto) {

        return await lock.acquire('Balance', async ()=>{
            this.balances = balances;

            for (const [currency, amount] of Object.entries(this.balances)) {
                    let balance = await this.balanceRepository.findOneBy({
                        currency,                    
                    });
                    if (!balance) {
                        if (compareTo(amount, 0)>0) {
                            balance = await this.balanceRepository.create({
                                currency,                   
                                amount
                            });       
                        }             
                    } else {

                        if (compareTo(balance.amount, amount) !=0) {
                            this.log.info('Balance discrepancy', currency, 'Need:', balance.amount, 'Reel:', amount);
                        }
                        balance.amount = amount;                    
                    }

                    if (balance)
                        await this.balanceRepository.save(balance);
            }
        });

    }

    public async loadBalancesAmount() {
        const balances = await this.balanceRepository.find();
        for (const balance of balances) {
            this.balances[balance.currency] = balance.amount;
        }
    }

    public async getBalanceAmount(currency: string) {

        if (this.balances[currency] != undefined) {
            return this.balances[currency];
        }

        let balance = await this.balanceRepository.findOneBy({
            currency,                    
        });
        if (balance) {
            this.balances[currency] = balance.amount;
            return balance.amount;
        } else {
            return 0;
        }
    }

    public async income(currency:string, amount:number) {
        
        if (this.balances[currency] != undefined) {
            this.balances[currency] = add(this.balances[currency], amount);
        }

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