import { Inject, Injectable, Scope } from "@nestjs/common";
import { BotService } from "./bot.service";
import { FileLogService } from "../log/filelog.service";
import { SEC_IN_HOUR, elapsedSecondsFrom, sleep, isSuitableRate } from "../helpers";
import { AccountService } from "../exchange/account.service";
import { BalanceService } from "../balance/balance.service";
import { OrderService } from "../order/order.service";
import { Order } from "../order/entities/order.entity";
import { ApiService } from "../exchange/api.service";
import { PairService } from "../exchange/pair.service";
import { AccountsReadyToBuy } from "../analitics/accountsReadyToBuy.service";
import { ActiveOrdersAboveProfit } from "../analitics/activeOrdersAboveProfit.service";

const { divide, subtract, multiply, compareTo, add } = require("js-big-decimal");


interface Config {		
	minBuyRateMarginToProcess: number,
	minSellRateMarginToProcess: number,
	balanceSync: boolean,	
}

@Injectable()
export class LonelyTraderService {

	accountId = 1;
	config: Config;
	api:ApiService;
	accountConfig;
	activeOrders:Array<Order>=[];

	constructor(

		public bot: BotService,
		private log: FileLogService,
		private accounts: AccountService,
		private balance: BalanceService,
		private orders: OrderService,
		private pairs: PairService,
		private accountsReadyToBuy:AccountsReadyToBuy,		
		private activeOrdersAboveProfit:ActiveOrdersAboveProfit

	) {

		this.config = {		
			minBuyRateMarginToProcess: Number(process.env.BOT_MIN_BUY_RATE_MARGIN), // минимальное движение курса для проверки х100=%
			minSellRateMarginToProcess: Number(process.env.BOT_MIN_SELL_RATE_MARGIN),
			balanceSync: process.env.BOT_BALANCE_SYNC == 'true'
		}

		const overalAccountConf = {			
			minDailyProfit: Number(process.env.BOT_MIN_DAILY_PROFIT), // % годовых если сделка закрывается за день
			minYearlyProfit: Number(process.env.BOT_MIN_YERLY_PROFIT), // % годовых если сделка живет больше дня						
			orderAmount: Number(process.env.BOT_ORDER_AMOUNT),
			pair: process.env.BOT_CURRENCY1 + '/' + process.env.BOT_CURRENCY2,
			currency1: process.env.BOT_CURRENCY1,
			currency2: process.env.BOT_CURRENCY2,			
		};

		if (process.env.BOT_TEST == 'true') {
			this.accounts.setAccount(this.accountId, {
				...overalAccountConf, ...{
					exchangeName: process.env.EXCHANGE_NAME,
					apiKey: process.env.EXCHANGE_TESTNET_API_KEY,
					secret: process.env.EXCHANGE_TESTNET_API_SECRET,
					isSandbox: true,
				}
			});
		} else {
			this.accounts.setAccount(this.accountId, {
				...overalAccountConf, ...{
					exchangeName: process.env.EXCHANGE_NAME,
					apiKey: process.env.EXCHANGE_API_KEY,
					secret: process.env.EXCHANGE_API_SECRET,
					isSandbox: false,
				}
			});
		}

		this.api = this.accounts.getApiForAccount(this.accountId);
		this.accountConfig = this.accounts.getConfig(this.accountId);
	}


	async trade() {
		
		let			
			lastBid: number = 1,
			lastStatUpdate = 0,
			lastTradesUpdate = Date.now() / 1000;
			
			await this.prepare();

		while (true) {

			try {

				if (elapsedSecondsFrom(SEC_IN_HOUR, lastStatUpdate)) {
					await this.saveStat(this.accountId, this.accountConfig.currency1, this.accountConfig.currency2);
					lastStatUpdate = Date.now() / 1000;
				}

				if (elapsedSecondsFrom(SEC_IN_HOUR / 4, lastTradesUpdate)) {
					await this.checkCloseOrders();
					lastTradesUpdate = Date.now() / 1000;
				}

				const { buyRate: rateBid, sellRate: rateAsk } = await this.pairs.getOrRefreshPair(this.accountConfig.currency1, this.accountConfig.currency2);

				if (isSuitableRate(rateBid, lastBid, this.config.minBuyRateMarginToProcess)) {
					this.log.info('Rate ask: ', rateAsk);
					const orders = await this.tryToBuy();
					if (orders.length>0) {
						await this.checkCloseOrders();
					}
				}

				if (isSuitableRate(rateBid, lastBid, this.config.minSellRateMarginToProcess)) {
					this.log.info('Rate bid: ', rateBid);
					await this.tryToSellAllSuitableOrders();
					
					lastBid = rateBid;					
				}

			} catch (e) {

				this.log.error('Trade error...wait 60 sec', e.message, e.stack);
				await sleep(60);
			}
		}
	}

	async tryToBuy() {
		const orders=[];		
		const result=[];
		this.log.info('Find accounts to buy....');
		const accounts = await this.accountsReadyToBuy.get(this.accountConfig.orderAmount, this.config.minBuyRateMarginToProcess);
		this.log.info('Ok....'+accounts.length + ' accounts');
		for(const account of accounts) {
			result.push(
				this.bot.createBuyOrder(
					account.accountId,
					account.currency1,
					account.currency2,
					account.rate,
					account.amount1
				).then(order => {
					orders.push(order);
				})
			);
		}

		await Promise.all(orders);

		return orders;
	}

	
	public async tryToSellAllSuitableOrders(): Promise<Array<Order>> {


		this.log.info('Get active orders....');
		const tm = Date.now();
		const orders = await this.activeOrdersAboveProfit.get(
			this.accountConfig.minDailyProfit,
			this.accountConfig.minYearlyProfit
		);

		this.log.info('Ok...' + orders.length + ' orders ..' + ((Date.now() - tm) / 1000) + ' sec');

		const result=[];
		for (const order of orders) {
			result.push(
				this.bot.createCloseOrder(order.buyRate, order)
			);
		}

		await Promise.all(result);

		return orders;
	}

	private async prepare() {

		let syncStatus = false;

		while (!syncStatus) {
			try {

				// тут нужно загрузить в базу текущий баланс и в текущую переменную
				await this.balance.loadBalancesAmount(this.accountId);
				await this.checkBalance();

				// проверить состояние открытых ордеров
				await this.checkCloseOrders();			

				syncStatus = true;
			} catch (e) {

				this.log.error('Sync error...wait 5 min', e.message, e.stack);
				await sleep(5 * 60);
			}
		}
	}

	public isRateOccupied(rate: number, activeOrders: Array<Order>, minMargin: number) {

		const rateFrom = multiply(rate, (1-minMargin));
		const rateTo = multiply(rate, (1+minMargin));

		for (const order of activeOrders) {
			if (
				compareTo(order.rate, rateFrom) > 0 && 
				compareTo(order.rate, rateTo) < 0
			) {
				return true;
			}
		}
		return false;
		
	}

	public async loadActiveOrders() {
		this.activeOrders = await this.orders.getActiveOrders();
		return this.activeOrders;
	}

	private canBuy(accountId: any) {
		// Пока это просто рандом
		return (Math.floor(Math.random() * 100) + 1) <= this.accountConfig.orderProbability;
	}


	private async checkCloseOrders() {
		const closedOrders = await this.bot.checkCloseOrders();
		if (closedOrders.length > 0) {

			await this.checkBalance();

		}
	}

	private async checkBalance() {
		if (this.config.balanceSync)
			await this.balance.set(this.accountId, await this.api.fetchBalances());
	}


	private async saveStat(accountId: number, currency1: string, currency2: string) {

		const pair = currency1 + '/' + currency2;
		const balance1 = await this.balance.getBalanceAmount(accountId, currency1);
		const balance2 = await this.balance.getBalanceAmount(accountId, currency2);
		const rate = await this.api.getLastPrice(pair);

		this.log.stat(
			currency1,
			balance1,
			currency2,
			balance2,
			'Total in ' + currency2,
			multiply(rate, balance1)
		);


	}

}