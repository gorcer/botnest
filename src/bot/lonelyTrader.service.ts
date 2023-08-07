import { Inject, Injectable, Scope } from "@nestjs/common";
import { BotService } from "./bot.service";
import { FileLogService } from "../log/filelog.service";
import { SEC_IN_HOUR, elapsedSecondsFrom, sleep, isSuitableRate } from "../helpers";
import { PublicApiService } from "../exchange/publicApi.service";
import { AccountService } from "../exchange/account.service";
import { BalanceService } from "../balance/balance.service";
import { BalancesDto } from "../balance/dto/balances.dto";
import { OrderService } from "../order/order.service";
import { OrderSideEnum } from "../order/entities/order.entity";

const { divide, subtract, multiply, compareTo, add } = require("js-big-decimal");


interface Config {
	pair: string,
	currency1: string,
	currency2: string,
	minBuyRateMarginToProcess: number,
	minSellRateMarginToProcess: number,
	balanceSync: boolean
}

@Injectable()
export class LonelyTraderService {

	accountId = 1;
	config: Config;
	api: { getActualRates: (arg0: string) => PromiseLike<{ bid: any; ask: any; }> | { bid: any; ask: any; }; fetchBalances: () => BalancesDto | PromiseLike<BalancesDto>; getLastPrice: (arg0: string) => any; };
	accountConfig: { orderProbability: number; };

	constructor(

		public bot: BotService,
		private log: FileLogService,
		private accounts: AccountService,
		private balance: BalanceService,
		private orders: OrderService,

	) {

		this.config = {
			currency1: process.env.BOT_CURRENCY1,
			currency2: process.env.BOT_CURRENCY2,
			minBuyRateMarginToProcess: Number(process.env.BOT_MIN_BUY_RATE_MARGIN), // минимальное движение курса для проверки х100=%
			minSellRateMarginToProcess: Number(process.env.BOT_MIN_SELL_RATE_MARGIN),
			pair: process.env.BOT_CURRENCY1 + '/' + process.env.BOT_CURRENCY2,
			balanceSync: process.env.BOT_BALANCE_SYNC == 'true'
		}

		if (process.env.BOT_TEST == 'true') {
			this.accounts.setAccount(this.accountId, {
				exchangeName: process.env.EXCHANGE_NAME,
				apiKey: process.env.EXCHANGE_TESTNET_API_KEY,
				secret: process.env.EXCHANGE_TESTNET_API_SECRET,
				isSandbox: true,

				pair: process.env.TESTBOT_CURRENCY1 + '/' + process.env.TESTBOT_CURRENCY2,
				orderAmount: Number(process.env.TESTBOT_ORDER_AMOUNT),
				currency1: process.env.TESTBOT_CURRENCY1,
				currency2: process.env.TESTBOT_CURRENCY2,
				orderProbability: Number(process.env.TESTBOT_ORDER_PROBABILITY),

			});
		} else {
			this.accounts.setAccount(this.accountId, {
				exchangeName: process.env.EXCHANGE_NAME,
				apiKey: process.env.EXCHANGE_API_KEY,
				secret: process.env.EXCHANGE_API_SECRET,
				isSandbox: false,

				pair: process.env.BOT_CURRENCY1 + '/' + process.env.BOT_CURRENCY2,
				orderAmount: Number(process.env.BOT_ORDER_AMOUNT),
				currency1: process.env.BOT_CURRENCY1,
				currency2: process.env.BOT_CURRENCY2,
				orderProbability: Number(process.env.BOT_ORDER_PROBABILITY),

			});
		}

		this.bot.setConfig({

			minDailyProfit: Number(process.env.BOT_MIN_DAILY_PROFIT), // % годовых если сделка закрывается за день
			minYearlyProfit: Number(process.env.BOT_MIN_YERLY_PROFIT), // % годовых если сделка живет больше дня			
			sellFee: Number(process.env.BOT_SELL_FEE),
		});

		this.api = this.accounts.getApiForAccount(this.accountId);
		this.accountConfig = this.accounts.getConfig(this.accountId);
	}



	async trade() {


		const lastOrder = await this.orders.getLastOrder(this.accountId);
		let startRate=1;
		if (lastOrder.side == OrderSideEnum.BUY) {
			startRate = lastOrder.rate;
		}
		let
			lastAsk: number = startRate,
			lastBid: number = startRate,
			lastStatUpdate = 0,
			lastTradesUpdate = Date.now()/1000,
			syncStatus = false;




		while (!syncStatus) {
			try {

				// тут нужно загрузить в базу текущий баланс и в текущую переменную
				await this.balance.loadBalancesAmount(this.accountId);
				await this.checkBalance();

				await this.bot.syncData(this.accountId);

				// проверить состояние открытых ордеров
				await this.checkCloseOrders();
				syncStatus = true;
			} catch (e) {

				this.log.error('Sync error...wait 5 min', e.message, e.stack);
				await sleep(5 * 60);
			}
		}


		while (true) {

			try {

				if (elapsedSecondsFrom(SEC_IN_HOUR, lastStatUpdate)) {
					await this.saveStat(this.accountId, this.config.currency1, this.config.currency2);
					lastStatUpdate = Date.now()/1000;
				}

				if (elapsedSecondsFrom(SEC_IN_HOUR, lastTradesUpdate)) {
					await this.checkCloseOrders();
					lastTradesUpdate = Date.now()/1000;
				}

				const { bid: rateBid, ask: rateAsk } = await this.api.getActualRates(this.config.pair);

				if (isSuitableRate(rateAsk, lastAsk, this.config.minBuyRateMarginToProcess)) {
					if (await this.bot.tryToBuy(this.accountId, rateAsk)) {
						this.checkBalance();
					}
					lastAsk = rateAsk;
					this.log.info('Rate ask: ', rateAsk);
				}

				if (isSuitableRate(rateBid, lastBid, this.config.minSellRateMarginToProcess)) {
					const closedOrders = await this.bot.tryToSell(this.config.currency1, this.config.currency2, rateBid);
					if (closedOrders.length) { // если что-то закрылось, то можно снова купить
						lastAsk = 1;
					}

					lastBid = rateBid;
					this.log.info('Rate bid: ', rateBid);
				}


			} catch (e) {

				this.log.error('Trade error...wait 60 sec', e.message, e.stack);
				await sleep(60);
			}
		}
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