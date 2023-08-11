import { Injectable } from "@nestjs/common";
import { BalancesDto } from "./dto/balances.dto";
import { InjectRepository } from "@nestjs/typeorm";
import { Balance } from "./entities/balance.entity";
import { Repository } from "typeorm";
import { lock } from "../helpers";
import { FileLogService } from "../log/filelog.service";
import { BalanceLog, OperationType } from "./entities/balanceLog.entity";
const { compareTo, multiply, add, subtract } = require("js-big-decimal");

@Injectable()
export class BalanceService {

    balances: {
        (account_id: number): Balance
    } | {} = {};

    constructor(
        
        @InjectRepository(Balance)
        private balanceRepository: Repository<Balance>,

        @InjectRepository(BalanceLog)
        private balanceLogRepository: Repository<BalanceLog>,
        
        private log: FileLogService,

    ) { }

    public async set(accountId: number, balances: BalancesDto) {

        return await lock.acquire('Balance', async () => {
            this.balances[accountId] = balances;
            let operationType: OperationType;
            let operationAmount;

            for (const [currency, amount] of Object.entries(balances)) {
                let balance = await this.balanceRepository.findOneBy({
                    accountId,
                    currency,
                });
                if (!balance) {
                    if (compareTo(amount, 0) > 0) {
                        balance = this.balanceRepository.create({
                            accountId,
                            currency,
                            amount: amount
                        });
                        operationType = OperationType.INIT;
                        operationAmount = amount;
                    }
                } else {

                    if (compareTo(balance.amount, amount) != 0) {
                        this.log.info('Balance discrepancy', currency, 'Need:', balance.amount, 'Reel:', amount);
                        operationType = OperationType.ACTUALIZE;
                        operationAmount = subtract(amount, balance.amount);
                        balance.amount = amount;
                    }                    
                }

                if (balance) {
                    await this.balanceRepository.save(balance);

                    if (operationType) {
                        this.balanceLogRepository.save(
                            this.balanceLogRepository.create({
                                accountId: balance.accountId,
                                balanceId: balance.id,
                                operationType,
                                amount: operationAmount,
                                total: balance.amount,                                
                            })
                        );
                    }
                }
            }
        });

    }

    public async loadBalances(accountId: number) {
        const balances = await this.balanceRepository.find();
        for (const balance of balances) {
            if (!this.balances[accountId])
                this.balances[accountId] = {};

            this.balances[accountId][balance.currency] = balance;
        }
    }

    public async getBalanceAmount(accountId: number, currency: string) {

        await this.checkBalances(accountId);
        if (this.balances[accountId]?.[currency] != undefined) {
            return this.balances[accountId][currency].amount;
        } else {
            return 0;
        }
    }

    private async checkBalances(accountId) {
        if (!this.balances[accountId]) {
            return this.loadBalances(accountId);
        }

    }


    public async income(accountId: number, currency: string, sourceId:number, operationType: OperationType, amount: number) {

        await this.checkBalances(accountId);

        if (this.balances[accountId]?.[currency] == undefined) {
            throw new Error('Unknown balance ' + accountId + ' ' + currency);
        }

        const balance = this.balances[accountId][currency];
        balance.amount = add(balance.amount, amount);
        await this.balanceRepository.save(balance);

        this.balanceLogRepository.save(
            this.balanceLogRepository.create({
                accountId: balance.accountId,
                balanceId: balance.id,
                operationType,
                amount: amount,
                total: balance.amount,
                sourceId
            })
        );


        return balance;
    }

    public async outcome(accountId: number, currency: string, sourceId:number, operationType: OperationType, amount: number) {
        return this.income(accountId, currency, sourceId, operationType, multiply(-1, amount));
    }


}