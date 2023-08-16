import { Injectable } from "@nestjs/common";
import { ApiService } from "../exchange/api.service";
import { PairService } from "../exchange/pair.service";
import { PublicApiService } from "../exchange/publicApi.service";
import { Order } from "../order/entities/order.entity";
import { BuyStrategyInterface } from "../strategy/interfaces/buyStrategy.interface";
import { StrategyInterface } from "../strategy/interfaces/strategy.interface";
import { StrategyService } from "../strategy/strategy.service";
import { AccountService } from "../user/account.service";
import { UpdateAccountDto } from "../user/dto/update-account.dto";
import { Account } from "../user/entities/account.entity";
import { PairRatesDto } from "./dto/pair-rates.dto";
import { TradeService } from "./trade.service";
import { OrderService } from "../order/order.service";

@Injectable()
export class BotNest {


	constructor(
		public trade: TradeService,
		private accounts: AccountService,
		private pairs: PairService,
		private strategies: StrategyService,
		public publicApi: PublicApiService,
		private orders: OrderService,
	) { }

	public async addStrategy(strategyModel) {
		this.trade.addStrategy(strategyModel);
	}

	async setUserAccount(userId:number, config) {
		const account = await this.accounts.fetchOrCreate(userId);
		return this.accounts.setAccount(account, config);
	}

	async getApiForAccount(accountId: number):Promise<ApiService> {
		return this.accounts.getApiForAccount(accountId);
	}

	async actualizePair(pairName: string) {
		const pair = await this.pairs.fetchOrCreate(pairName);
		await this.pairs.actualize(pair)
		return pair;
	}

	async setStrategyForAccount(where:object, strategy:any, config: any) {    
		return this.strategies.setStrategyForAccount(where, strategy, config);
	}

	async checkCloseOrders(): Promise<Array<Order>> {
		return this.trade.checkCloseOrders();
	}

	public async setRates(rates: PairRatesDto ) {

		for (const [pairName, rate] of Object.entries(rates)) {
			const pair = await this.pairs.fetchOrCreate(pairName);
			await this.pairs.setInfo(pair, {
				buyRate: rate.bid,
				sellRate: rate.ask
			});
		}
	}

	async runBuyStrategies() {
		return this.trade.runBuyStrategies();
	}

	async runSellStrategies() {
		return this.trade.runSellStrategies();
	}

	public async getActualRates(pairName:string):Promise<{bid:number, ask:number}> {
		return this.publicApi.getActualRates(pairName);
	}

	public async getActiveOrdersSum(currency1: string, attribute: string) {
		return this.orders.getActiveOrdersSum(currency1, attribute);
	}
}