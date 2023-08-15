import { FileLogService } from "../log/filelog.service";
import { SEC_IN_HOUR, elapsedSecondsFrom, sleep, isSuitableRate, extractCurrency } from "../helpers";
import { BalanceService } from "../balance/balance.service";
import { ApiService } from "../exchange/api.service";
import { FillCellsStrategy } from "../strategy/buyFillCellsStrategy/fillCellsStrategy.strategy";
import { Account } from "../user/entities/account.entity";
import { PairRatesDto } from "../bot/dto/pair-rates.dto";
import { AwaitProfitStrategy } from "../strategy/sellAwaitProfitStrategy/awaitProfitStrategy.strategy";
import { BotNest } from "../bot/botnest.service";
import { Injectable } from "@nestjs/common";

const { divide, subtract, multiply, compareTo, add } = require("js-big-decimal");


@Injectable()
export class IterableTraderService {

	account: Account;
	pairs: Array<string>;
	api: ApiService;
	accountConfig;
	lastRates = {};
	minBuyRateMarginToProcess = 0.0001;
	minSellRateMarginToProcess = 0.0001;


	constructor(		
		private log: FileLogService,		
		private balance: BalanceService,		
		private botnest: BotNest
	) {
	}


	async trade() {

		let
			lastStatUpdate = 0,
			lastTradesUpdate = Date.now() / 1000;

		await this.init();
		await this.prepare();

		while (true) {

			try {

				// Проверяем есть ли значимое изменение курса
				const { isBidMargined, isAskMargined, changedPairs } = await this.checkRates(this.pairs, this.minBuyRateMarginToProcess, this.minSellRateMarginToProcess);

				// Если есть, то отправляем курс боту
				if (isBidMargined || isAskMargined) {
					await this.botnest.setRates(changedPairs);
				}

				const promises = [];
				// Запускаем стратегии покупки
				if (isBidMargined) {
					promises.push(this.botnest.runBuyStrategies());
					// const orders = await this.tryToBuy();
					// if (orders.length > 0) {
					// 	await this.checkCloseOrders();
					// }
				}

				// Запускаем стратегии продажи
				if (isAskMargined) {
					promises.push(this.botnest.runSellStrategies());
					// await this.tryToSellAllSuitableOrders();
				}

				if (promises.length > 0) {
					await Promise.all(promises);
				}


				if (elapsedSecondsFrom(SEC_IN_HOUR, lastStatUpdate)) {
					await this.saveStat(this.account.id, this.pairs);
					lastStatUpdate = Date.now() / 1000;
				}

				if (elapsedSecondsFrom(SEC_IN_HOUR / 4, lastTradesUpdate)) {
					await this.checkCloseOrders();
					lastTradesUpdate = Date.now() / 1000;
				}

				for (const pairName of this.pairs) {
					this.api.watchTrades(pairName).then((items => {
						this.log.info('Watch trade', items[0]?.info?.id);
					}));
				}


			} catch (e) {

				this.log.error('Trade error...wait 60 sec', e.message, e.stack);
				await sleep(60);
			}
		}
	}

	async checkRates(pairs: Array<string>, minBuyRateMarginToProcess: number, minSellRateMarginToProcess: number): Promise<{ isBidMargined: boolean, isAskMargined: boolean, changedPairs: PairRatesDto }> {

		let isBidMargined = false, isAskMargined = false;
		const changedPairs = {};

		for (const pairName of pairs) {

			const rates = await this.botnest.getActualRates(pairName);
			isBidMargined = isSuitableRate(rates.bid, this.lastRates[pairName]?.bid, minBuyRateMarginToProcess);
			isAskMargined = isSuitableRate(rates.ask, this.lastRates[pairName]?.ask, minSellRateMarginToProcess);

			if (isBidMargined || isAskMargined) {

				changedPairs[pairName] = rates;

				this.log.info('Rates by ' + pairName + ': ', rates);

				this.lastRates[pairName] = rates;
			}

		}

		return { isBidMargined, isAskMargined, changedPairs };
	}

	private async init() {

		this.pairs = process.env.PAIRS.replace(' ', '').split(',');

		this.botnest.addStrategy(FillCellsStrategy);
		this.botnest.addStrategy(AwaitProfitStrategy);

		this.account = await this.botnest.setUserAccount(1, {
			exchangeName: process.env.EXCHANGE_NAME,
			apiKey: process.env.EXCHANGE_API_KEY,
			secret: process.env.EXCHANGE_API_SECRET,
			testMode: process.env.TEST_MODE == 'true',			
		});
		this.api = await this.botnest.getApiForAccount(this.account.id);

		// актуализируем пары и стратегии
		for (const pairName of this.pairs) {

			const pair = await this.botnest.actualizePair(pairName)

			const { currency2 } = extractCurrency(pairName);
			const balance = await this.balance.getBalance(this.account.id, currency2);

			await this.botnest.setStrategyForAccount(
				this.account.id,
				FillCellsStrategy,
				{
					orderAmount: Number(process.env.STRATEGY_BUY_ORDER_AMOUNT),
					risk: process.env.BOT_BUY_RISK,
					pairId: pair.id,
					cellSize: FillCellsStrategy.calculateCellSize({
						balance,
						pair,
						orderAmount: Number(process.env.STRATEGY_BUY_ORDER_AMOUNT),
						risk: process.env.BOT_BUY_RISK,
					})
				});
		}



		await this.botnest.setStrategyForAccount(
			this.account.id,
			AwaitProfitStrategy,
			{
				minDailyProfit: Number(process.env.STRATEGY_SELL_MIN_DAILY_PROFIT), // % годовых если сделка закрывается за день
				minYearlyProfit: Number(process.env.STRATEGY_SELL_MIN_ANNUAL_PROFIT), // % годовых если сделка живет больше дня						
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
		const closedOrders = await this.botnest.checkCloseOrders();
		if (closedOrders.length > 0) {

			await this.checkBalance();

		}
	}

	private async checkBalance() {		
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