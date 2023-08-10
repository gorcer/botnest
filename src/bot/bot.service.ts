import { Injectable } from "@nestjs/common";
import { BalanceService } from "../balance/balance.service";
import { OrderService } from "../order/order.service";
import { Order, OrderSideEnum } from "../order/entities/order.entity";
import { UpdateOrderDto } from "../order/dto/update-order.dto";
import { lock, sleep, SEC_IN_YEAR, checkLimits } from "../helpers";
import { ApiService } from "../exchange/api.service";
import { FileLogService } from "../log/filelog.service";
import { AccountService } from "../exchange/account.service";
import { PublicApiService } from "../exchange/publicApi.service";
import { PairService } from "../exchange/pair.service";
import { OperationType } from "../balance/entities/balanceLog.entity";

const { divide, subtract, multiply, compareTo, add } = require("js-big-decimal");

@Injectable()
export class BotService {

	constructor(

		public balance: BalanceService,
		private orders: OrderService,
		private log: FileLogService,
		public publicApi: PublicApiService,
		private accounts: AccountService,
		private pairs: PairService

	) { }



	private api(accountId): ApiService {
		return this.accounts.getApiForAccount(accountId);
	}


	public async checkCloseOrder(order: Order, extOrder?): Promise<Order> {
		
		const api = this.api(order.accountId);

		return await lock.acquire('Balance' + order.accountId, async () => {

			this.log.info('Check close order', order.extOrderId);

			if (!order.isActive || order.side != OrderSideEnum.SELL)
				return;

			if (!extOrder)
				extOrder = await api.fetchOrder(Number(order.extOrderId), order.pairTitle);

			if (compareTo(extOrder.filled, extOrder.amount) == 0) {

				const { feeCost, feeInCurrency2Cost, feeCurrency } = await this.extractFee(extOrder.fees, order.currency2);

				await this.orders.update(order.id, { isActive: false, filled: extOrder.filled, fee: feeInCurrency2Cost });

				await this.balance.income(order.accountId, order.currency2, order.id, OperationType.SELL, order.amount2);
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
					updateOrderDto.profitPc = divide(multiply(SEC_IN_YEAR, updateOrderDto.profit), (order.createdAtSec - parentOrder.createdAtSec), 15)

				}
				await this.orders.update(parentOrder.id, updateOrderDto);

				this.log.info('Order closed',
					parentOrder.id, '=>', order.id,
					'Profit: ',
					updateOrderDto.profit,
					extOrder
				);

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


	public async createBuyOrder(accountId: number, currency1: string, currency2: string, price: number, amount1: number) {

		const api = this.api(accountId);
		const pair = currency1 + '/' + currency2;

		return await lock.acquire('Balance' + accountId, async () => {
			this.log.info('Try to buy', price, amount1, multiply(amount1, price));

			const extOrder = await api.createOrder(pair, 'market', 'buy', amount1);

			if (extOrder.id != undefined) {

				const { feeCost, feeInCurrency2Cost, feeCurrency } = await this.extractFee(extOrder.fees, currency2);

				// store in db
				const order = await this.orders.create({
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

				await this.balance.income(accountId, order.currency1, order.id, OperationType.BUY, extOrder.amount);
				await this.balance.outcome(accountId, order.currency2, order.id, OperationType.BUY, extOrder.cost);
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
			const { lastPrice } = await this.pairs.getOrRefreshPair(fee.currency, currency2);
			if (!lastPrice) {
				throw new Error("Unknown fee pair" + lastPrice);
			}

			return multiply(fee.cost, lastPrice);

		} else {
			return fee.cost;
		}
	}


	public async createCloseOrder(price: number, order: Order): Promise<Order> {

		let closeOrder: Order;		
		const api = this.api(order.accountId);
		const pair = order.currency1 + '/' + order.currency2;
		let extOrder;

		await lock.acquire('Balance' + order.accountId, async () => {

			extOrder = await api.createOrder(pair, 'limit', 'sell', subtract(order.amount1, order.prefilled), price);

			if (extOrder.id != undefined) {
				// store in db
				closeOrder = await this.orders.create({
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
					order.id, ' => ', closeOrder.id,
					closeOrder.extOrderId,
					closeOrder.rate,
					closeOrder.amount1,
					closeOrder.amount2,
					extOrder
				);

				await this.balance.outcome(order.accountId, order.currency1, closeOrder.id, OperationType.SELL, closeOrder.amount1);

				await this.orders.update(order.id, { prefilled: add(order.prefilled, extOrder.amount) })

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