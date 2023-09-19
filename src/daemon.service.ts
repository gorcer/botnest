import { Injectable } from "@nestjs/common";
import { BotNest } from "./bot/botnest.service";
import { FillCellsStrategy } from "./strategy/buyFillCellsStrategy/fillCellsStrategy.strategy";
import { AwaitProfitStrategy } from "./strategy/sellAwaitProfitStrategy/awaitProfitStrategy.strategy";
import { SEC_IN_HOUR, elapsedSecondsFrom } from "./helpers";
import { FileLogService } from "./log/filelog.service";

@Injectable()
export class DaemonService {

    minBuyRateMarginToProcess;
	minSellRateMarginToProcess;
	pairs: Array<string>;

    constructor(
        private botnest: BotNest,
        private log: FileLogService
    ) {

    }

    private async init() {

		this.minBuyRateMarginToProcess = process.env.DAEMON_MIN_BUY_RATE_MARGIN;
		this.minSellRateMarginToProcess = process.env.DAEMON_MIN_SELL_RATE_MARGIN;
		this.pairs = process.env.PAIRS.replace(' ', '').split(',');

		this.botnest.addStrategy(FillCellsStrategy);
		this.botnest.addStrategy(AwaitProfitStrategy);

        this.log.info('Actualize pairs ...');
        for (const pairName of this.pairs) {
			await this.botnest.actualizePair(pairName)
        }
        this.log.info('Ok');
    }

    async trade() {

        let lastTradesUpdate = Date.now() / 1000;
        await this.init();

        while(true) {
            	
            const promises = [];

                

				const { isBidMargined, isAskMargined, changedPairs } = await this.botnest.checkRates(
                    this.pairs, 
                    this.minBuyRateMarginToProcess, 
                    this.minSellRateMarginToProcess
                    );
				
				if (isBidMargined || isAskMargined) {
					await this.botnest.setRates(changedPairs);
				}				
				
				if (isBidMargined) {
					promises.push(this.botnest.runBuyStrategies());				
				}

				
				if (isAskMargined) {
					promises.push(this.botnest.runSellStrategies());			
				}

                if (elapsedSecondsFrom(SEC_IN_HOUR / 4, lastTradesUpdate)) {
                    promises.push(this.botnest.checkCloseOrders());
                    lastTradesUpdate = Date.now() / 1000;
                }

				if (promises.length > 0) {
					await Promise.all(promises);
				}

        }


    }
}