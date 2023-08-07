import { Injectable } from "@nestjs/common";
import { BalanceService } from "../balance/balance.service";
import { OrderService } from "../order/order.service";
import { Order, OrderSideEnum } from "../order/entities/order.entity";
import { UpdateOrderDto } from "../order/dto/update-order.dto";
import { lock, sleep, SEC_IN_YEAR } from "../helpers";
import { ApiService } from "../exchange/api.service";
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
	private config: any = {};

	constructor(

		public balance: BalanceService,
		private order: OrderService,
		private log: FileLogService,
		private publicApi: PublicApiService,
		private accounts: AccountService,

	) { }


	setConfig(config) {
		this.config = config;
	}


	private accountConfig(accountId): Config {
		return this.accounts.getConfig(accountId);
	}

	private api(accountId): ApiService {
		return this.accounts.getApiForAccount(accountId);
	}


	public async checkCloseOrder(order: Order, extOrder?): Promise<Order> {

		const accountId = order.accountId;
		const config = this.accountConfig(accountId);
		const api = this.api(order.accountId);

		return await lock.acquire('Balance' + order.accountId, async () => {

			this.log.info('Check order', order.extOrderId);

			if (!order.isActive || order.side != OrderSideEnum.SELL)
				return;

			if (!extOrder)
				extOrder = await api.fetchOrder(Number(order.extOrderId), order.pair);

			if (compareTo(extOrder.filled, extOrder.amount) == 0) {

				const { feeCost, feeInCurrency2Cost, feeCurrency } = await this.extractFee(extOrder.fees, order.currency2);

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
					updateOrderDto.profitPc = divide(multiply(SEC_IN_YEAR, updateOrderDto.profit) , (order.createdAtSec - parentOrder.createdAtSec), 15)

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
	public async tryToBuy(accountId: number, rate: number): Promise<boolean> {

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



	public async tryToSell(currency1: string, currency2: string, rate: number): Promise<Array<Order>> {

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

	async extractFee(feeObj, currency2) {
		const fee = feeObj[0];
		const feeCost = feeObj[0]?.cost ?? 0;
		const feeInCurrency2Cost = await this.calculateFee(feeObj[0], currency2);
		const feeCurrency = fee?.currency;

		return { feeCost, feeInCurrency2Cost, feeCurrency };
	}


	public async createBuyOrder(accountId: number, currency1: string, currency2: string, price: number, amount1: number) {

		const api = this.api(accountId);		
		const pair = currency1 +'/'+currency2;

		return await lock.acquire('Balance' + accountId, async () => {
			this.log.info('Try to buy', price, amount1, multiply(amount1, price));

			const extOrder = await api.createOrder(pair, 'market', 'buy', amount1);

			if (extOrder.id != undefined) {

				const { feeCost, feeInCurrency2Cost, feeCurrency } = await this.extractFee(extOrder.fees, currency2);

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
				);

				return { extOrder, order };
			}
			return false;
		});
	}


	private async calculateFee(fee: { cost: number; currency: string; }, currency2: string) {

		if (!fee || !fee.cost || fee.cost == 0)
			return 0;

		if (!fee.currency)
			return fee.cost;

		if (fee.currency != currency2) {
			const pair = fee.currency + '/' + currency2;
			const rate = await this.publicApi.getLastPrice(pair);
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
		let extOrder;

		await lock.acquire('Balance' + order.accountId, async () => {

			extOrder = await api.createOrder(config.pair, 'limit', 'sell', subtract(order.amount1, order.prefilled), price);

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
				this.log.info("New close order",
					closeOrder.extOrderId,
					closeOrder.rate,
					closeOrder.amount1,
					closeOrder.amount2,
					extOrder
				);

				await this.balance.outcome(order.accountId, order.currency1, closeOrder.amount1);

				await this.order.update(order.id, { prefilled: add(order.prefilled, extOrder.amount) })

			}
		});

		// You cant move it up due node lock
		if (closeOrder)
			await this.checkCloseOrder(closeOrder, extOrder);


		return closeOrder;
	}


	async checkCloseOrders(): Promise<Array<Order>> {
		const closedOrders: Array<Order> = [];
		const orders = await this.order.findAll({ isActive: true, side: OrderSideEnum.SELL });
		for (const order of orders) {
			const closedOrder = await this.checkCloseOrder(order);
			if (closedOrder)
				closedOrders.push(closedOrder);
		}

		return closedOrders;

	}

	async syncData(accountId: number) {

		this.log.info('Sync data ....');

		// Загружаем лимиты @todo вынеси в publicApi
		({ minAmount: this.minAmount, minCost: this.minCost } = await this.publicApi.getLimits(this.accountConfig(accountId).pair));

		this.log.info('Ok');
	}


}