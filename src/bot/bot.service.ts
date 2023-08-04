import { Inject, Injectable, Scope } from "@nestjs/common";
import { BalanceService } from "../balance/balance.service";
import { OrderService } from "../order/order.service";
import { LogService } from "../log/log.service";
import { Order, OrderType } from "../order/entities/order.entity";
import { UpdateOrderDto } from "../order/dto/update-order.dto";
import { HOUR, elapsedSecondsFrom, lock, sleep } from "../helpers";
import { ApiService } from "../exchange/api.service";
import { Ticker } from "ccxt";
import { FileLogService } from "../log/filelog.service";


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
	balanceSync: boolean
}

@Injectable({ scope: Scope.TRANSIENT })
export class BotService {

	config: Config;
	
	private minAmount: number;
	private minCost: number;
	private tickers = {};
	private user_id = 0;


	constructor(

		public balance: BalanceService,
		private order: OrderService,
		private log: FileLogService,
		private api: ApiService,

	) { }


	setConfig(config: Config) {
		this.config = config;
	}

	async trade() {

		let
			lastAsk: number = 1,
			lastBid: number = 1,
			lastStatUpdate = 0,
			lastTradesUpdate = Date.now(),
			syncStatus = false;

		while (!syncStatus) {
			try {
				await this.syncData();

				// проверить состояние открытых ордеров
				await this.checkCloseOrders();
				syncStatus=true;
			} catch (e) {
				
				this.log.error('Sync error...wait 5 min', e.message, e.stack);
				await sleep(5*60);
			}
		}


		while (true) {

			// try {

				if (elapsedSecondsFrom(HOUR, lastStatUpdate)) {
					await this.saveStat();
					lastStatUpdate = Date.now();
				}

				if (elapsedSecondsFrom(HOUR, lastTradesUpdate)) {
					await this.checkCloseOrders();		
					lastTradesUpdate = Date.now();			
				}				

				const { bid: rateBid, ask: rateAsk } = await this.api.getActualRates(this.config.pair);
				

				if (this.isSuitableRate(rateAsk, lastAsk, this.config.minBuyRateMarginToProcess)) {
					
					await this.tryToBuy(rateAsk, this.user_id);
					lastAsk = rateAsk;
					this.log.info('Rate ask: ', rateAsk);
				}

				if (this.isSuitableRate(rateBid, lastBid, this.config.minSellRateMarginToProcess)) {
					
					const closedOrders = await this.tryToSell(rateBid);
					if (closedOrders.length) { // если что-то закрылось, то можно снова купить
						lastAsk=1;
					}

					lastBid = rateBid;
					this.log.info('Rate bid: ', rateBid);
				}

				// await sleep(1);
				
			// } catch (e) {
				
			// 	this.log.error('Trade error...wait 60 sec', e.message, e.stack);
			// 	await sleep(60);
			// }

		}
	}

	private async saveStat() {

		const balance1 = await this.balance.getBalanceAmount(this.config.currency1);
		const balance2 = await this.balance.getBalanceAmount(this.config.currency2);
		const rate = this.tickers[this.config.pair];

		this.log.stat(
			this.config.currency1,
			balance1,
			this.config.currency2,
			balance2,
			this.config.currency1 + ' in ' + this.config.currency2,
			multiply(rate, balance1)
		);


	}

	private isSuitableRate(rate: number, lastRate: number, needMargin:number) {
		const margin = divide(Math.abs(lastRate - rate), lastRate, 15);
		return compareTo(margin, needMargin) > 0;
	}


	public async checkCloseOrder(order: Order, extOrder?): Promise<Order>  {

		return await lock.acquire('Balance', async () => {

			this.log.info('Check order', order.extOrderId);

			if (!order.isActive || order.type != OrderType.SELL)
				return;

			if(!extOrder)
				extOrder = await this.api.fetchOrder(Number(order.extOrderId), this.config.pair);

			if (compareTo(extOrder.filled, extOrder.amount) == 0) {

				const fee = extOrder.fees[0];
				let feeCost = fee?.cost ?? 0;
				let feeInCurrency2Cost = this.calculateFee(fee);

				await this.order.update(order.id, { isActive: false, filled: extOrder.filled, fee: feeInCurrency2Cost });

				await this.balance.income(this.config.currency2, order.amount2);
				if (feeCost && fee?.currency) {
					await this.balance.outcome(fee?.currency, feeCost);
				}

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
					parentOrder.extOrderId, 'Profit: ', 
					updateOrderDto.profit,
					extOrder
				);

				return order;
			}

			return false;

		});


	}

	private async checkBalance() {
		if (this.config.balanceSync)
			await this.balance.set(await this.api.fetchBalances());
	}

	private async tryToBuy(rate: number, user_id: number) {

		const amount1: number = this.checkLimits(rate, this.config.orderAmount);
		const amount2: number = multiply(rate, amount1);
		const balance2: number = await this.balance.getBalanceAmount(this.config.currency2);

		if (compareTo(balance2, amount2) > 0) {

			await this.createBuyOrder(user_id, rate, amount1);
			await this.checkBalance();
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

	private canBuy() {
		// Пока это просто рандом
		return (Math.floor(Math.random() * 100) + 1) <= this.config.orderProbability;
	}


	private async tryToSell(rate: number) {

		const rateWithSellFee = multiply(rate, (1 - this.config.sellFee));

		this.log.info('Get active orders....');
		const tm = Date.now();
		const orders: Array<Order> = await this.order.getActiveOrdersAboveProfit(this.config.pair, rateWithSellFee, this.config.minDailyProfit, this.config.minYearlyProfit);

		this.log.info('Ok...' + orders.length + ' orders ..' + ((Date.now() - tm) / 1000) + ' sec');


		for (const order of orders) {
			await this.createCloseOrder(rate, order);
		}		

		return orders;
	}


	public async createBuyOrder(user_id:number, price: number, amount1: number) {

		return await lock.acquire('Balance', async () => {
			this.log.info('Try to buy', price, amount1, multiply(amount1, price));

			const extOrder = await this.api.createOrder(this.config.pair, 'market', 'buy', amount1);

			if (extOrder.id != undefined) {

				const fee = extOrder.fees[0];
				let feeCost = extOrder.fees[0]?.cost ?? 0;
				let feeInCurrency2Cost = this.calculateFee(extOrder.fees[0]);

				// store in db
				const order = await this.order.create({
					pair: this.config.pair,
					extOrderId: extOrder.id,
					expectedRate: price,
					rate: extOrder.price,
					amount1: extOrder.amount,
					amount2: extOrder.cost,
					fee: feeInCurrency2Cost,
					userId: user_id
				});

				await this.balance.income(this.config.currency1, extOrder.amount);
				await this.balance.outcome(this.config.currency2, extOrder.cost);
				if (feeCost && fee?.currency) {
					await this.balance.outcome(fee?.currency, feeCost);
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


	private calculateFee(fee) {

		if (!fee || !fee.cost || fee.cost == 0)
			return 0;

		if (!fee.currency)
			return fee.cost;

		if (fee.currency != this.config.currency2) {
			const pair = fee.currency + '/' + this.config.currency2;
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

		await lock.acquire('Balance', async () => {

			const extOrder = await this.api.createOrder(this.config.pair, 'limit', 'sell', subtract(order.amount1, order.prefilled), price);

			if (extOrder.id != undefined) {
				// store in db
				closeOrder = await this.order.create({
					pair: this.config.pair,
					extOrderId: extOrder.id,
					expectedRate: price,
					rate: extOrder.price,
					amount1: extOrder.amount,
					amount2: multiply(extOrder.amount, extOrder.price),
					parentId: order.id,
					type: OrderType.SELL,
					userId: order.userId
				});

				await this.balance.outcome(this.config.currency1, closeOrder.amount1);

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
		const orders = await this.order.findAll({ isActive: true, type: OrderType.SELL });
		for (const order of orders) {
			const closedOrder = await this.checkCloseOrder(order);
			if (closedOrder)
				closedOrders.push(closedOrder);
		}
		if (closedOrders.length > 0) {
			await this.checkBalance();
		}

		return closedOrders;

	}

	async syncData() {

		this.log.info('Sync data ....');

		// Загружаем курсы
		for (const [key, value] of Object.entries((await this.api.fetchTickers()))) {
			this.tickers[key] = (value as Ticker).last;
		}

		// Загружаем лимиты
		({ minAmount: this.minAmount, minCost: this.minCost } = await this.api.getLimits(this.config.pair));

		// тут нужно загрузить в базу текущий баланс и в текущую переменную
		await this.balance.loadBalancesAmount();
		await this.checkBalance();		

		this.log.info('Ok');
	}


}