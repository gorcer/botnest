import { Inject, Injectable, Scope } from "@nestjs/common";
import { BalanceService } from "../balance/balance.service";
import { OrderService } from "../order/order.service";
import { LogService } from "../log/log.service";
import { Order, OrderSideEnum } from "../order/entities/order.entity";
import { UpdateOrderDto } from "../order/dto/update-order.dto";
import { HOUR, elapsedSecondsFrom, lock, sleep } from "../helpers";
import { ApiService } from "../exchange/api.service";
import {Ticker} from 'ccxt';
import { FileLogService } from "../log/filelog.service";
import { AccountService } from "../exchange/account.service";
import { PublicApiService } from "../exchange/publicApi.service";


const { divide, subtract, multiply, compareTo, add } = require("js-big-decimal");

interface Config {
	pair: string,
	orderAmount: number,
	currency1: string,
	currency2: string,
	orderProbability: number,
	minDailyProfit: number,
	minYearlyProfit: number,
	minBuyRateMarginToProcess: number,
	minSellRateMarginToProcess: number,
	sellFee: number,
	
}

@Injectable()
export class BotService {


	private minAmount: number;
	private minCost: number;
	private tickers = {};
	private config:any={};

	constructor(

		public balance: BalanceService,
		private order: OrderService,
		private log: FileLogService,
		private publicApi: PublicApiService,
		private accounts: AccountService,		

	) {}


	 setConfig(config) {
		this.config = config;
	 }


	// async trade() {

	// 	let
	// 		lastAsk: number = 1,
	// 		lastBid: number = 1,
	// 		lastStatUpdate = 0,
	// 		lastTradesUpdate = Date.now(),
	// 		syncStatus = false;

	// 	while (!syncStatus) {
	// 		try {
	// 			await this.syncData(this.accountId);

	// 			// проверить состояние открытых ордеров
	// 			await this.checkCloseOrders();
	// 			syncStatus=true;
	// 		} catch (e) {
				
	// 			this.log.error('Sync error...wait 5 min', e.message, e.stack);
	// 			await sleep(5*60);
	// 		}
	// 	}


	// 	while (true) {

	// 		try {

	// 			if (elapsedSecondsFrom(HOUR, lastStatUpdate)) {
	// 				await this.saveStat(this.accountId);
	// 				lastStatUpdate = Date.now();
	// 			}

	// 			if (elapsedSecondsFrom(HOUR, lastTradesUpdate)) {
	// 				await this.checkCloseOrders();		
	// 				lastTradesUpdate = Date.now();			
	// 			}				

	// 			const { bid: rateBid, ask: rateAsk } = await this.publicApi.getActualRates(this.accountConfig(this.accountId).pair);
				

	// 			if (this.isSuitableRate(rateAsk, lastAsk, this.accountConfig(this.accountId).minBuyRateMarginToProcess)) {
	// 				await this.tryToBuy(this.accountId, rateAsk);
	// 				lastAsk = rateAsk;
	// 				this.log.info('Rate ask: ', rateAsk);
	// 			}

	// 			if (this.isSuitableRate(rateBid, lastBid, this.accountConfig(this.accountId).minSellRateMarginToProcess)) {
	// 				const closedOrders = await this.tryToSell(rateBid);
	// 				if (closedOrders.length) { // если что-то закрылось, то можно снова купить
	// 					lastAsk=0;
	// 				}

	// 				lastBid = rateBid;
	// 				this.log.info('Rate bid: ', rateBid);
	// 			}
				
				
	// 		} catch (e) {
				
	// 			this.log.error('Trade error...wait 60 sec', e.message, e.stack);
	// 			await sleep(60);
	// 		}

	// 	}
	// }

	private accountConfig(accountId):Config {
		return this.accounts.getConfig(accountId);
	}

	private api(accountId):ApiService {
		return this.accounts.getApiForAccount(accountId);
	}

	// private async saveStat(accountId) {

	// 	const balance1 = await this.balance.getBalanceAmount(accountId, this.accountConfig(accountId).currency1);
	// 	const balance2 = await this.balance.getBalanceAmount(accountId, this.accountConfig(accountId).currency2);
	// 	const rate = this.tickers[this.accountConfig(accountId).pair];

	// 	this.log.stat(
	// 		this.accountConfig(accountId).currency1,
	// 		balance1,
	// 		this.accountConfig(accountId).currency2,
	// 		balance2,
	// 		this.accountConfig(accountId).currency1 + ' in ' + this.accountConfig(accountId).currency2,
	// 		multiply(rate, balance1)
	// 	);


	// }

	// public isSuitableRate(rate: number, lastRate: number, needMargin:number) {
	// 	const margin = divide(Math.abs(lastRate - rate), lastRate, 15);
	// 	return compareTo(margin, needMargin) > 0;
	// }


	public async checkCloseOrder(order: Order, extOrder?): Promise<Order>  {

		const accountId  = order.accountId;
		const config = this.accountConfig(accountId);
		const api = this.api(order.accountId);
		
		return await lock.acquire('Balance'+order.accountId, async () => {

			this.log.info('Check order', order.extOrderId);

			if (!order.isActive || order.side != OrderSideEnum.SELL)
				return;

			if(!extOrder)
				extOrder = await api.fetchOrder(Number(order.extOrderId), order.pair);

			if (compareTo(extOrder.filled, extOrder.amount) == 0) {

				const {feeCost, feeInCurrency2Cost, feeCurrency} = this.extractFee(extOrder.fees, order.currency2);

				await this.order.update(order.id, { isActive: false, filled: extOrder.filled, fee: feeInCurrency2Cost });

				await this.balance.income(order.accountId, order.currency2, order.amount2);
				if (feeCost && feeCurrency) {
					await this.balance.outcome(order.accountId, feeCurrency, feeCost);
				}

				// Fill parent buy-order
				const parentOrder = await this.order.findOne({ id: order.parentId });
				const updateOrderDto: UpdateOrderDto = {
					filled: add(parentOrder.filled, extOrder.filled)
				};
				if (compareTo(parentOrder.amount1, updateOrderDto.filled) == 0) {

					const totalAmount2 = await this.order.getSumByParentId(parentOrder.id, 'amount2');
					updateOrderDto.isActive = false;
					updateOrderDto.profit = subtract(
												subtract(
													subtract(
														totalAmount2,
														parentOrder.amount2
													),
													feeInCurrency2Cost
												),
												parentOrder.fee
											);

				}
				await this.order.update(parentOrder.id, updateOrderDto);

				this.log.info('Close order ', 
					parentOrder.extOrderId, 
					'Profit: ', 
					updateOrderDto.profit,
					extOrder
				);

				return order;
			}

			return false;

		});
	}
	public async tryToBuy(accountId: number, rate: number):Promise<boolean> {

		const config = this.accountConfig(accountId);
		const amount1: number = this.checkLimits(rate, config.orderAmount);
		const amount2: number = multiply(rate, amount1);
		const balance2: number = await this.balance.getBalanceAmount(accountId, config.currency2);

		if (compareTo(balance2, amount2) > 0) {

			await this.createBuyOrder(
				accountId, 
				config.currency1, 
				config.currency2, 
				rate, 
				amount1
				);
			
			return true;
		} else {
			this.log.info('Cant buy, needs ' + amount2 + ' but have only ' + balance2);
			await sleep(60);
			return false;
		}
	}


	/**
	 * 
	 * @param price Fix amount to limits
	 * @param amount1 
	 * @returns 
	 */
	private checkLimits(price: number, amount1: number) {
		if (compareTo(amount1, this.minAmount) < 0)
			amount1 = this.minAmount;

		const amount2 = multiply(price, amount1);
		if (compareTo(amount2, this.minCost) < 0) {
			amount1 = divide(this.minCost * 1.1, price, 6);
		}

		return amount1;
	}



	public async tryToSell(currency1:string, currency2:string,rate: number):Promise<Array<Order>> {

		const rateWithSellFee = multiply(rate, (1 - this.config.sellFee));

		this.log.info('Get active orders....');
		const tm = Date.now();
		const orders: Array<Order> = await this.order.getActiveOrdersAboveProfit(
			currency1, 
			currency2, 
			rateWithSellFee, 
			this.config.minDailyProfit, 
			this.config.minYearlyProfit
			);

		this.log.info('Ok...' + orders.length + ' orders ..' + ((Date.now() - tm) / 1000) + ' sec');


		for (const order of orders) {
			await this.createCloseOrder(rate, order);
		}		

		return orders;
	}

	extractFee(feeObj, currency2) {
		const fee = feeObj[0];
		const feeCost = feeObj[0]?.cost ?? 0;
		const feeInCurrency2Cost = this.calculateFee(feeObj[0], currency2);
		const feeCurrency = fee?.currency;

		return {feeCost, feeInCurrency2Cost, feeCurrency};
	}


	public async createBuyOrder(accountId:number, currency1, currency2, price: number, amount1: number) {

		const api = this.api(accountId);
		const config = this.accountConfig(accountId);

		return await lock.acquire('Balance'+accountId, async () => {
			this.log.info('Try to buy', price, amount1, multiply(amount1, price));

			const extOrder = await api.createOrder(config.pair, 'market', 'buy', amount1);

			if (extOrder.id != undefined) {
				
				const {feeCost, feeInCurrency2Cost, feeCurrency} = this.extractFee(extOrder.fees, currency2);

				// store in db
				const order = await this.order.create({
					currency1,
					currency2,
					extOrderId: extOrder.id,
					expectedRate: price,
					rate: extOrder.price,
					amount1: extOrder.amount,
					amount2: extOrder.cost,
					fee: feeInCurrency2Cost,
					accountId
				});

				await this.balance.income(accountId, order.currency1, extOrder.amount);
				await this.balance.outcome(accountId, order.currency2, extOrder.cost);
				if (feeCost && feeCurrency) {
					await this.balance.outcome(accountId, feeCurrency, feeCost);
				}

				this.log.info(
					"New order",
					order.extOrderId,
					order.rate,
					order.amount1,
					order.amount2,
					extOrder, 
					// 'Balance 1: ' + await this.balance.getBalanceAmount(this.config.currency1),
					// 'Balance 2: ' + await this.balance.getBalanceAmount(this.config.currency2),
					// 'Active orders: '+OrderService.getActiveOrdersCount()
					// order
				);

				return { extOrder, order };
			}
			return false;
		});
	}


	private calculateFee(fee, currency2) {

		if (!fee || !fee.cost || fee.cost == 0)
			return 0;

		if (!fee.currency)
			return fee.cost;

		if (fee.currency != currency2) {
			const pair = fee.currency + '/' + currency2;
			const rate = this.tickers[pair];
			if (!rate) {
				throw new Error("Unknown fee pair" + pair);
			}

			return multiply(fee.cost, rate);

		} else {
			return fee.cost;
		}
	}


	public async createCloseOrder(price: number, order: Order): Promise<Order> {

		let closeOrder: Order;
		const accountId = order.accountId;
		const config = this.accountConfig(accountId);
		const api = this.api(order.accountId);

		await lock.acquire('Balance'+order.accountId, async () => {

			const extOrder = await api.createOrder(config.pair, 'limit', 'sell', subtract(order.amount1, order.prefilled), price);

			if (extOrder.id != undefined) {
				// store in db
				closeOrder = await this.order.create({
					currency1: order.currency1,					
					currency2: order.currency2,
					extOrderId: extOrder.id,
					expectedRate: price,
					rate: extOrder.price,
					amount1: extOrder.amount,
					amount2: multiply(extOrder.amount, extOrder.price),
					parentId: order.id,
					side: OrderSideEnum.SELL,
					accountId: order.accountId
				});

				await this.balance.outcome(order.accountId, order.currency1, closeOrder.amount1);

				await this.order.update(order.id, { prefilled: add(order.prefilled, extOrder.amount) })

				await this.checkCloseOrder(closeOrder, extOrder);

				this.log.info("New close order",
					closeOrder.extOrderId,
					closeOrder.rate,
					closeOrder.amount1,
					closeOrder.amount2,
					extOrder
				);
			}
		});
		

		return closeOrder;
	}


	async checkCloseOrders(): Promise<Array<Order>> {
		const closedOrders:Array<Order>  = [];
		const orders = await this.order.findAll({ isActive: true, side: OrderSideEnum.SELL });
		for (const order of orders) {
			const closedOrder = await this.checkCloseOrder(order);
			if (closedOrder)
				closedOrders.push(closedOrder);
		}
		
		return closedOrders;

	}

	async syncData(accountId:number) {

		this.log.info('Sync data ....');

		// Загружаем курсы @todo вынеси в publicApi
		for (const [key, value] of Object.entries((await this.publicApi.fetchTickers()))) {
			this.tickers[key] = (value as Ticker).last;
		}

		// Загружаем лимиты @todo вынеси в publicApi
		({ minAmount: this.minAmount, minCost: this.minCost } = await this.publicApi.getLimits(this.accountConfig(accountId).pair));		

		this.log.info('Ok');
	}


}