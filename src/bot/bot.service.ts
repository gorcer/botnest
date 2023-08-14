import { Injectable } from "@nestjs/common";
import { BalanceService } from "../balance/balance.service";
import { OrderService } from "../order/order.service";
import { Order, OrderSideEnum } from "../order/entities/order.entity";
import { UpdateOrderDto } from "../order/dto/update-order.dto";
import { lock, SEC_IN_YEAR, extractCurrency } from "../helpers";
import { ApiService } from "../exchange/api.service";
import { FileLogService } from "../log/filelog.service";
import { AccountService } from "../user/account.service";
import { PublicApiService } from "../exchange/publicApi.service";
import { OperationType } from "../balance/entities/balanceLog.entity";
import { RequestSellInfoDto } from "../strategy/dto/request-sell-info.dto";
import { RequestBuyInfoDto } from "../strategy/dto/request-buy-info.dto";
import { StrategyService } from "../strategy/strategy.service";
import { BuyStrategyInterface } from "../strategy/interfaces/buyStrategy.interface";
import { SellStrategyInterface } from "../strategy/interfaces/sellStrategy.interface";

const { divide, subtract, multiply, compareTo, add } = require("js-big-decimal");

@Injectable()
export class BotService {


	buyStrategies: Array<BuyStrategyInterface> = [];
	sellStrategies: Array<SellStrategyInterface> = [];

	constructor(

		public balance: BalanceService,
		private orders: OrderService,
		private log: FileLogService,
		public publicApi: PublicApiService,
		private accounts: AccountService,
		private strategies: StrategyService

	) { }

	private api(accountId): Promise<ApiService> {
		return this.accounts.getApiForAccount(accountId);
	}

	public async addStrategy(strategyName) {
		const strategy = this.strategies.getStrategy(strategyName);
		if (strategy.side == OrderSideEnum.BUY) {
			this.buyStrategies.push(strategy);
		} else {
			this.sellStrategies.push(strategy);
		}
	}

	runBuyStrategies() {
		this.buyStrategies.forEach(async (strategy) => {

			const orders = [];
			const result = [];
			this.log.info(strategy.constructor.name + ': Find accounts to buy....');
			const accounts = await strategy.get();
			this.log.info(strategy.constructor.name + ': Ok....' + accounts.length + ' accounts');
			for (const account of accounts) {
				result.push(
					this.createBuyOrder(
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

		})
	}


	runSellStrategies() {
		this.sellStrategies.forEach(async (strategy) => {
			this.log.info(strategy.constructor.name + ': Get active orders....');
			const tm = Date.now();
			const orderInfos = await strategy.get();

			this.log.info(strategy.constructor.name + ': Ok...' + orderInfos.length + ' orders ..' + ((Date.now() - tm) / 1000) + ' sec');

			const result = [];
			for (const orderInfo of orderInfos) {
				result.push(
					this.createCloseOrder(orderInfo)
				);
			}

			await Promise.all(result);

			return orderInfos;
		})
	};

	public async checkCloseOrder(order: Order, extOrder?): Promise<Order> {

		const api = await this.api(order.accountId);
		const { currency2 } = extractCurrency(order.pairName);

		return await lock.acquire('Balance' + order.accountId, async () => {

			this.log.info('Check close order', order.extOrderId);

			if (!order.isActive || order.side != OrderSideEnum.SELL)
				return;

			if (!extOrder)
				extOrder = await api.fetchOrder(Number(order.extOrderId), order.pairName);

			if (compareTo(extOrder.filled, extOrder.amount) == 0) {

				const { feeCost, feeInCurrency2Cost, feeCurrency } = await this.extractFee(extOrder.fees, currency2);

				await this.orders.update(order.id, { isActive: false, filled: extOrder.filled, fee: feeInCurrency2Cost });

				await this.balance.income(order.accountId, currency2, order.id, OperationType.SELL, order.amount2);
				if (feeCost && feeCurrency) {
					await this.balance.outcome(order.accountId, feeCurrency, order.id, OperationType.SELL_FEE, feeCost);
				}

				// Fill parent buy-order
				const parentOrder = await this.orders.findOne({ id: order.parentId });
				const updateOrderDto: UpdateOrderDto = {
					filled: add(parentOrder.filled, extOrder.filled)
				};
				if (compareTo(parentOrder.amount1, updateOrderDto.filled) == 0) {

					const totalAmount2 = await this.orders.getSumByParentId(parentOrder.id, 'amount2');
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
					updateOrderDto.anualProfitPc = divide(
						multiply(
							SEC_IN_YEAR,
							divide(updateOrderDto.profit, subtract(order.createdAtSec, parentOrder.createdAtSec), 15)
						),
						parentOrder.amount2,
						15);

					updateOrderDto.closedAt = new Date();


					this.log.info('Order closed',
						parentOrder.id, '=>', order.id,
						'Profit: ',
						updateOrderDto.profit,
						extOrder
					);
				}
				await this.orders.update(parentOrder.id, updateOrderDto);


				return order;
			}

			return false;

		});
	}

	async extractFee(feeObj: { cost: number; currency: string; }[], currency2: string) {
		const fee = feeObj[0];
		const feeCost = feeObj[0]?.cost ?? 0;
		const feeInCurrency2Cost = await this.calculateFee(feeObj[0], currency2);
		const feeCurrency = fee?.currency;

		return { feeCost, feeInCurrency2Cost, feeCurrency };
	}


	public async createBuyOrder(accountId: number, pairId: number, pairName: string, price: number, amount1: number) {

		const api = await this.api(accountId);
		const { currency1, currency2 } = extractCurrency(pairName);

		return await lock.acquire('Balance' + accountId, async () => {
			this.log.info('Try to buy', price, amount1, multiply(amount1, price));

			const extOrder = await api.createOrder(pairName, 'market', 'buy', amount1);

			if (extOrder.id != undefined) {

				const { feeCost, feeInCurrency2Cost, feeCurrency } = await this.extractFee(extOrder.fees, currency2);

				// store in db
				const order = await this.orders.create({
					pairId,
					pairName,
					currency1,
					currency2,
					extOrderId: extOrder.id,
					expectedRate: price,
					rate: extOrder.price,
					amount1: extOrder.amount,
					amount2: extOrder.cost,
					fee: feeInCurrency2Cost,
					accountId,
					createdAtSec: Math.floor(Date.now() / 1000)
				});

				await this.balance.income(accountId, currency1, order.id, OperationType.BUY, extOrder.amount);
				await this.balance.outcome(accountId, currency2, order.id, OperationType.BUY, extOrder.cost);
				if (feeCost && feeCurrency) {
					await this.balance.outcome(accountId, feeCurrency, order.id, OperationType.BUY_FEE, feeCost);
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
			const lastPrice = await this.publicApi.getLastPrice(pair);
			if (!lastPrice) {
				throw new Error("Unknown fee pair" + lastPrice);
			}

			return multiply(fee.cost, lastPrice);

		} else {
			return fee.cost;
		}
	}


	public async createCloseOrder(orderInfo: RequestSellInfoDto): Promise<Order> {

		const price = orderInfo.rate;
		let closeOrder: Order;
		const api = await this.api(orderInfo.accountId);
		const pairName = orderInfo.pairName;
		const { currency1, currency2 } = extractCurrency(pairName);
		let extOrder;

		await lock.acquire('Balance' + orderInfo.accountId, async () => {

			extOrder = await api.createOrder(pairName, 'limit', 'sell', orderInfo.needSell, price);

			if (extOrder.id != undefined) {
				// store in db
				closeOrder = await this.orders.create({
					pairName,
					currency1,
					currency2,
					pairId: orderInfo.pairId,
					extOrderId: extOrder.id,
					expectedRate: price,
					rate: extOrder.price,
					amount1: extOrder.amount,
					amount2: multiply(extOrder.amount, extOrder.price),
					parentId: orderInfo.id,
					side: OrderSideEnum.SELL,
					accountId: orderInfo.accountId,
					createdAtSec: Math.floor(Date.now() / 1000)
				});
				this.log.info("New close order",
					orderInfo.id, ' => ', closeOrder.id,
					closeOrder.extOrderId,
					closeOrder.rate,
					closeOrder.amount1,
					closeOrder.amount2,
					extOrder
				);

				await this.balance.outcome(orderInfo.accountId, currency1, closeOrder.id, OperationType.SELL, closeOrder.amount1);

				await this.orders.update(orderInfo.id, { prefilled: add(orderInfo.prefilled, extOrder.amount) })

			}
		});

		// You cant move it up due node lock
		if (closeOrder)
			await this.checkCloseOrder(closeOrder, extOrder);


		return closeOrder;
	}


	async checkCloseOrders(): Promise<Array<Order>> {
		const closedOrders: Array<Order> = [];
		const orders = await this.orders.findAll({ isActive: true, side: OrderSideEnum.SELL });
		for (const order of orders) {
			const closedOrder = await this.checkCloseOrder(order);
			if (closedOrder)
				closedOrders.push(closedOrder);
		}

		return closedOrders;
	}

}