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


## Installation:

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

All you need it's BotNest - it is all in one service.

```javascript
import { BotNest } from "../bot/botnest.service";
import { FillCellsStrategy } from "../strategy/buyFillCellsStrategy/fillCellsStrategy.strategy";
import { AwaitProfitStrategy } from "../strategy/sellAwaitProfitStrategy/awaitProfitStrategy.strategy";
 
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
        minDailyProfit: Number(process.env.STRATEGY_SELL_MIN_DAILY_PROFIT), 
        minYearlyProfit: Number(process.env.STRATEGY_SELL_MIN_ANNUAL_PROFIT), 
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

```


Full example watch there:
```
src/example/inlineTrade.service.ts
```


## Run tests

```
npm test
```
