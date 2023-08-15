import { Injectable } from "@nestjs/common";
import { BotNest } from "../bot/botnest.service";
import { FillCellsStrategy } from "../strategy/buyFillCellsStrategy/fillCellsStrategy.strategy";
import { AwaitProfitStrategy } from "../strategy/sellAwaitProfitStrategy/awaitProfitStrategy.strategy";

@Injectable()
export class InlineTradeService {

    constructor(
        private botnest: BotNest
    ) {

    }

    async trade() {

        const pairName = process.env.PAIRS.replace(' ', '').split(',')[0];
        const userId = 1;
        const cellSize = 50; // step for FillCellsStrategy
        const pair = await this.botnest.actualizePair(pairName)

        // set bot strategies
        this.botnest.addStrategy(FillCellsStrategy);
        this.botnest.addStrategy(AwaitProfitStrategy);

        // add test account
        const account = await this.botnest.setUserAccount(userId, {
            exchangeName: process.env.EXCHANGE_NAME,
            apiKey: process.env.EXCHANGE_API_KEY,
            secret: process.env.EXCHANGE_API_SECRET,
            testMode: process.env.TEST_MODE == 'true',
        });

        // set buy strategy config for account
        await this.botnest.setStrategyForAccount(
            account.id,
            FillCellsStrategy,
            {
                orderAmount: Number(process.env.STRATEGY_BUY_ORDER_AMOUNT),
                risk: process.env.BOT_BUY_RISK,
                pairId: pair.id,
                cellSize: process.env.INLINE_CELLSIZE
            });

        // set sell strategy for account
        await this.botnest.setStrategyForAccount(
            account.id,
            AwaitProfitStrategy,
            {
                minDailyProfit: Number(process.env.STRATEGY_SELL_MIN_DAILY_PROFIT), // % годовых если сделка закрывается за день
                minYearlyProfit: Number(process.env.STRATEGY_SELL_MIN_ANNUAL_PROFIT), // % годовых если сделка живет больше дня						
            });


        // checking orders before start
        await this.botnest.checkCloseOrders();

        //get current rates
        const rates = await this.botnest.getActualRates(pairName);
        if (!rates.ask || !rates.bid) {
            throw new Error('Cant resolve current rate, try to repeat later')
        }

        // set current rates
        await this.botnest.setRates({
            pairName: rates
        });

        // run buy strategies
        await this.botnest.runBuyStrategies();

        // run sell strategies
        await this.botnest.runSellStrategies();

    }

}