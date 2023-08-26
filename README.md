# Nest.JS + CCXT Trading Bot

This is a trading bot for a cryptocurrency exchange with an ability to use custom strategies.
There are two strategies on the board:

1) FillCells - bot purchase bitcoin with predefined steps (every $50 of rates for example). If there is an already opened order with current rate step found, the purchase is not made.

2) AwaitProfit - bot is waiting for the exchange to rise and try to sell buyed bitcoin. If anual profit percent more that 200% then bot try to sell bitcoin. After 24 hours needed anual profit decreases to 30%.

These simple strategies will guarantee you at least 30% anual profits, just be patient) 


## Requirements:
1. API keys for Binance
2. PostgreSQL Server
3. Node v16.14.0


## Instalation:

```
npm install botnest
```

```
cp ./node_modules/botnest/.env.example .env
```
Or you can

```
git clone git@github.com:gorcer/botnest.git
cd botnest
```

Fill settings in .env 
(TEST_MODE = false for production)


# Usage as project (if you git clone it)

To run one iteration:
```
npm run example:inline
```

To run as daemon:
```
npm run example:daemon
```

# Usage as component

Create App module

```javascript
import { Module } from '@nestjs/common';
import { BotnestModule } from 'botnest';

@Module({
  imports: [
    BotnestModule.register()
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}

```

Create Service with initialization and simple logic 

```javascript
import { Injectable } from "@nestjs/common";
import { BotNest } from "botnest";
import { FillCellsStrategy } from "botnest";
import { AwaitProfitStrategy } from "botnest";

@Injectable()
export class ExampleInlineTrader {

    constructor(
        private botnest: BotNest
    ) {}

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
            {accountId: account.id, pairId:pair.id},
            FillCellsStrategy,
            {
                orderAmount: Number(process.env.STRATEGY_BUY_ORDER_AMOUNT),
                risk: process.env.STRATEGY_BUY_RISK,
                pairId: pair.id,
                cellSize: process.env.INLINE_CELLSIZE
            });

        // set sell strategy for account
        await this.botnest.setStrategyForAccount(
            {accountId: account.id},
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
```

Add Service to your AppModule providers section

```javascript
....
@Module({
  imports: [
    BotnestModule.register()
  ],
  controllers: [],
  providers: [ExampleInlineTrader],
})
....
```

Create simple command
```javascript
import { NestFactory } from '@nestjs/core';
import { BotnestModule } from 'botnest';
import { AppModule } from './app.module';
import { ExampleInlineTrader } from './exampleInlineTrader.service';


async function bootstrap() {

  const app = await NestFactory.create(AppModule);

  const command = process.argv[2];

  switch (command) {
    case 'trade':
      {
        const bot = await app.resolve(ExampleInlineTrader);
        await bot.trade();
      }
      break;    
  }
  await app.close();
  process.exit(0);
}

bootstrap();

```


Add script to package.json
```javascript
scripts: {
    ....
    "console": "ts-node ./src/console.ts",
    "trade": "npm run console trade"
}
```

Fill .env file

Run
```
npm run trade
```

Enjoy!

## Create you own strategy

You can use BuyStrategyInterface and SellStrategyInterface to create you own strategy.

Strategy can be added to bot with method  
```
botnest.addStrategy(...);
```

And don`t forget to add account settings:
```
this.botnest.setStrategyForAccount(condition, strategy, config );
```



## Tests

```
npm test
```
