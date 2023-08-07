import { Injectable } from "@nestjs/common";
import { BalancesDto } from "./dto/balances.dto";
import { InjectRepository } from "@nestjs/typeorm";
import { Balance } from "./entities/balance.entity";
import { Repository } from "typeorm";
import { lock } from "../helpers";
import { FileLogService } from "../log/filelog.service";
const { compareTo } = require("js-big-decimal");

const { multiply, add } = require("js-big-decimal");

@Injectable()
export class BalanceService {

    balances: {
        (account_id: number): BalancesDto
    } | {} = {};

    constructor(
        @InjectRepository(Balance)
        private balanceRepository: Repository<Balance>,
        private log: FileLogService,

    ) { }

    public async set(accountId: number, balances: BalancesDto) {

        return await lock.acquire('Balance', async () => {
            this.balances[accountId] = balances;

            for (const [currency, amount] of Object.entries(balances)) {
                let balance: Balance = await this.balanceRepository.findOneBy({
                    accountId,
                    currency,
                });
                if (!balance) {
                    if (compareTo(amount, 0) > 0) {
                        balance = await this.balanceRepository.create({
                            accountId,
                            currency,
                            amount: amount
                        });
                    }
                } else {

                    if (compareTo(balance.amount, amount) != 0) {
                        this.log.info('Balance discrepancy', currency, 'Need:', balance.amount, 'Reel:', amount);
                    }
                    balance.amount = amount;
                }

                if (balance)
                    await this.balanceRepository.save(balance);
            }
        });

    }

    public async loadBalancesAmount(accountId: number) {
        const balances = await this.balanceRepository.find();
        for (const balance of balances) {
            if (!this.balances[accountId])
                this.balances[accountId] = {};

            this.balances[accountId][balance.currency] = balance.amount;
        }
    }

    public async getBalanceAmount(accountId: number, currency: string) {

        if (this.balances[accountId]?.[currency] != undefined) {
            return this.balances[accountId][currency];
        }

        let balance = await this.balanceRepository.findOneBy({
            currency,
        });
        if (balance) {

            if (!this.balances[accountId])
                this.balances[accountId] = {};

            this.balances[accountId][currency] = balance.amount;
            return balance.amount;
        } else {
            return 0;
        }
    }

    private async checkBalances(accountId) {
        if (!this.balances[accountId])  {
            this.loadBalancesAmount(accountId);
        }

    }


    public async income(accountId: number, currency: string, amount: number) {

        this.checkBalances(accountId);

        if (this.balances[accountId]?.[currency] != undefined) {
            this.balances[accountId][currency] = add(this.balances[accountId][currency], amount);
        }

        let balance = await this.balanceRepository.findOneBy({
            accountId,
            currency,
        });
        if (balance) {
            balance.amount = add(balance.amount, amount);
        }
        await this.balanceRepository.save(balance);





        return balance;
    }

    public async outcome(accountId: number, currency: string, amount: number) {
        return this.income(accountId, currency, multiply(-1, amount));
    }


}