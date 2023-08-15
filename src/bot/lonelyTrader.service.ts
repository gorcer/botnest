import { Inject, Injectable, Scope } from "@nestjs/common";
import { BotService } from "./bot.service";
import { FileLogService } from "../log/filelog.service";
import { SEC_IN_HOUR, elapsedSecondsFrom, sleep, isSuitableRate, extractCurrency } from "../helpers";
import { AccountService } from "../user/account.service";
import { BalanceService } from "../balance/balance.service";
import { ApiService } from "../exchange/api.service";
import { PairService } from "../exchange/pair.service";
import { FillCellsStrategy } from "../strategy/buyFillCellsStrategy/fillCellsStrategy.strategy";
import { AwaitProfitStrategy } from "../strategy/sellAwaitProfitStrategy/awaitProfitStrategy.strategy";
import { RequestSellInfoDto } from "../strategy/dto/request-sell-info.dto";
import { StrategyService } from "../strategy/strategy.service";
import { FillCells } from "../strategy/buyFillCellsStrategy/fillCells.entity";
import { AwaitProfit } from "../strategy/sellAwaitProfitStrategy/awaitProfit.entity";
import { Account } from "../user/entities/account.entity";

const { divide, subtract, multiply, compareTo, add } = require("js-big-decimal");


interface Config {
	minBuyRateMarginToProcess: number,
	minSellRateMarginToProcess: number,
	balanceSync: boolean,
	pairs: Array<string>
}

@Injectable()
export class LonelyTraderService {

	account:Account;
	config: Config;
	api: ApiService;
	accountConfig;
	lastRates = {};

	constructor(

		public bot: BotService,
		private log: FileLogService,
		private accounts: AccountService,
		private balance: BalanceService,
		private pairs: PairService,
		private accountsReadyToBuy: FillCellsStrategy,
		private activeOrdersAboveProfit: AwaitProfitStrategy,
		private strategies: StrategyService

	) {

		this.config = {
			minBuyRateMarginToProcess: Number(process.env.BOT_MIN_BUY_RATE_MARGIN), // минимальное движение курса для проверки х100=%
			minSellRateMarginToProcess: Number(process.env.BOT_MIN_SELL_RATE_MARGIN),
			balanceSync: process.env.BOT_BALANCE_SYNC == 'true',
			pairs: process.env.BOT_PAIRS.replace(' ', '').split(',')
		}

		this.bot.addStrategy(process.env.BOT_BUY_STRATEGY);
		this.bot.addStrategy(process.env.BOT_SELL_STRATEGY);
		
	}


	async trade() {

		let
			lastStatUpdate = 0,
			lastTradesUpdate = Date.now() / 1000;

		await this.init();			
		await this.prepare();

		while (true) {

			try {

				if (elapsedSecondsFrom(SEC_IN_HOUR, lastStatUpdate)) {
					await this.saveStat(this.account.id, this.config.pairs);
					lastStatUpdate = Date.now() / 1000;
				}

				if (elapsedSecondsFrom(SEC_IN_HOUR / 4, lastTradesUpdate)) {
					await this.checkCloseOrders();
					lastTradesUpdate = Date.now() / 1000;
				}

				const { isBidMargined, isAskMargined } = await this.checkRates(this.config.pairs, this.config.minBuyRateMarginToProcess, this.config.minSellRateMarginToProcess);

				if (isBidMargined) {
					this.bot.runBuyStrategies();
					// const orders = await this.tryToBuy();
					// if (orders.length > 0) {
					// 	await this.checkCloseOrders();
					// }
				}

				if (isAskMargined) {
					this.bot.runSellStrategies();
					// await this.tryToSellAllSuitableOrders();
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

				const pair = await this.pairs.fetchOrCreate(pairName);
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

	private async init() {
		this.account = await this.accounts.fetchOrCreate(1);
		if (process.env.BOT_TEST == 'true') {
			await this.accounts.setAccount(this.account, {
				exchangeName: process.env.EXCHANGE_NAME,
				apiKey: process.env.EXCHANGE_TESTNET_API_KEY,
				secret: process.env.EXCHANGE_TESTNET_API_SECRET,
				testMode: true,
			});
		} else {
			await this.accounts.setAccount(this.account, {
				exchangeName: process.env.EXCHANGE_NAME,
				apiKey: process.env.EXCHANGE_API_KEY,
				secret: process.env.EXCHANGE_API_SECRET,
				testMode: false,
			});
		}
		this.api = await this.accounts.getApiForAccount(this.account.id);

			// актуализируем пары и стратегии
			for (const pairName of this.config.pairs) {
				const pair = await this.pairs.fetchOrCreate(pairName);
				await this.pairs.actualize(pair)
				const {currency2} = extractCurrency(pairName);
				const balance = await this.balance.getBalance(this.account.id, currency2);

				await this.strategies.setStrategyForAccount(
					this.account.id,
					FillCells,
					{
						orderAmount: Number(process.env.BOT_ORDER_AMOUNT),
						pair,
						balance,
						risk: process.env.BOT_BUY_RISK
					});
			}

		

		await this.strategies.setStrategyForAccount(
			this.account.id,
			AwaitProfit,
			{
				minDailyProfit: Number(process.env.BOT_MIN_DAILY_PROFIT), // % годовых если сделка закрывается за день
				minYearlyProfit: Number(process.env.BOT_MIN_YERLY_PROFIT), // % годовых если сделка живет больше дня						
			});
	}


	private async prepare() {



		let syncStatus = false;

		while (!syncStatus) {
			try {

				// тут нужно загрузить в базу текущий баланс и в текущую переменную
				await this.balance.loadBalances(this.account.id);
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


	private async checkCloseOrders() {
		const closedOrders = await this.bot.checkCloseOrders();
		if (closedOrders.length > 0) {

			await this.checkBalance();

		}
	}

	private async checkBalance() {
		if (this.config.balanceSync)
			await this.balance.set(this.account.id, await this.api.fetchBalances());
	}


	private async saveStat(accountId: number, pairs: Array<string>) {

		for (const pair of pairs) {

			const { currency1, currency2 } = extractCurrency(pair);
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