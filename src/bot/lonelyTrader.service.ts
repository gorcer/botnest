import { Inject, Injectable, Scope } from "@nestjs/common";
import { BotService } from "./bot.service";
import { FileLogService } from "../log/filelog.service";
import { SEC_IN_HOUR, elapsedSecondsFrom, sleep, isSuitableRate, extractCurrency } from "../helpers";
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
	pairs: Array<string>
}

@Injectable()
export class LonelyTraderService {

	accountId = 1;
	config: Config;
	api: ApiService;
	accountConfig;
	lastRates = {};

	constructor(

		public bot: BotService,
		private log: FileLogService,
		private accounts: AccountService,
		private balance: BalanceService,
		private orders: OrderService,
		private pairs: PairService,
		private accountsReadyToBuy: AccountsReadyToBuy,
		private activeOrdersAboveProfit: ActiveOrdersAboveProfit

	) {

		this.config = {
			minBuyRateMarginToProcess: Number(process.env.BOT_MIN_BUY_RATE_MARGIN), // минимальное движение курса для проверки х100=%
			minSellRateMarginToProcess: Number(process.env.BOT_MIN_SELL_RATE_MARGIN),
			balanceSync: process.env.BOT_BALANCE_SYNC == 'true',
			pairs: process.env.BOT_PAIRS.replace(' ', '').split(',')
		}

		const overalAccountConf = {
			minDailyProfit: Number(process.env.BOT_MIN_DAILY_PROFIT), // % годовых если сделка закрывается за день
			minYearlyProfit: Number(process.env.BOT_MIN_YERLY_PROFIT), // % годовых если сделка живет больше дня						
			orderAmount: Number(process.env.BOT_ORDER_AMOUNT),
			pairs: process.env.BOT_PAIRS.replace(' ', '').split(',')
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
			lastStatUpdate = 0,
			lastTradesUpdate = Date.now() / 1000;

		await this.prepare();

		while (true) {

			try {

				if (elapsedSecondsFrom(SEC_IN_HOUR, lastStatUpdate)) {
					await this.saveStat(this.accountId, this.accountConfig.pairs);
					lastStatUpdate = Date.now() / 1000;
				}

				if (elapsedSecondsFrom(SEC_IN_HOUR / 4, lastTradesUpdate)) {
					await this.checkCloseOrders();
					lastTradesUpdate = Date.now() / 1000;
				}

				const { isBidMargined, isAskMargined } = await this.checkRates(this.config.pairs, this.config.minBuyRateMarginToProcess, this.config.minSellRateMarginToProcess);

				if (isBidMargined) {
					const orders = await this.tryToBuy();
					if (orders.length > 0) {
						await this.checkCloseOrders();
					}
				}

				if (isAskMargined) {
					await this.tryToSellAllSuitableOrders();
				}

			} catch (e) {

				this.log.error('Trade error...wait 60 sec', e.message, e.stack);
				await sleep(60);
			}
		}
	}

	async checkRates(pairs: Array<string>, minBuyRateMarginToProcess: number, minSellRateMarginToProcess: number): Promise<{ isBidMargined: boolean, isAskMargined: boolean }> {

		let isBidMargined = false, isAskMargined = false;

		for (const pairName of pairs) {

			const rates = await this.api.getActualRates(pairName);
			isBidMargined = isSuitableRate(rates.bid, this.lastRates[pairName]?.bid, this.config.minBuyRateMarginToProcess);
			isAskMargined = isSuitableRate(rates.ask, this.lastRates[pairName]?.ask, this.config.minSellRateMarginToProcess);

			if (isBidMargined || isAskMargined) {

				this.log.info('Rates by ' + pairName + ': ', rates);

				const pair = await this.pairs.fetchOrCreatePair(pairName);
				await this.pairs.setInfo(pair, {
					buyRate: rates.bid,
					sellRate: rates.ask
				});
				this.lastRates[pairName] = rates;

				return { isBidMargined, isAskMargined };
			}


		}

		return { isBidMargined, isAskMargined };
	}

	async tryToBuy() {
		const orders = [];
		const result = [];
		this.log.info('Find accounts to buy....');
		const accounts = await this.accountsReadyToBuy.get(this.accountConfig.orderAmount, this.config.minBuyRateMarginToProcess);
		this.log.info('Ok....' + accounts.length + ' accounts');
		for (const account of accounts) {
			result.push(
				this.bot.createBuyOrder(
					account.accountId,
					account.pairId,
					account.pairName,
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
		const orderInfos = await this.activeOrdersAboveProfit.get(
			this.accountConfig.minDailyProfit,
			this.accountConfig.minYearlyProfit
		);

		this.log.info('Ok...' + orderInfos.length + ' orders ..' + ((Date.now() - tm) / 1000) + ' sec');

		const result = [];
		for (const orderInfo of orderInfos) {
			result.push(
				this.bot.createCloseOrder(orderInfo)
			);
		}

		await Promise.all(result);

		return orderInfos;
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

				// актуализируем пары
				for (const pairName of this.config.pairs) {
					const pair = await this.pairs.fetchOrCreatePair(pairName);
					await this.pairs.actualize(pair)
				}

				syncStatus = true;
			} catch (e) {

				this.log.error('Sync error...wait 5 min', e.message, e.stack);
				await sleep(5 * 60);
			}
		}
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


	private async saveStat(accountId: number, pairs: Array<string>) {

		for (const pair of pairs) {

			const {currency1, currency2} = extractCurrency(pair);
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

}