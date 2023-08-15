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


## How to run:

```
git clone git@github.com:gorcer/botnest.git
cd botnest
```

```
cp .env.example .env
```


Fill settings in .env 
(TEST_MODE = false for production)


```
npm i
```

To run one iteration:
```
npm run example:inline
```

To run as daemon:
```
npm run example:daemon
```

# How to develop your own bot?

You neen BotNest - it is all in one service.

```
import { BotNest } from "../bot/botnest.service";
import { FillCellsStrategy } from "../strategy/buyFillCellsStrategy/fillCellsStrategy.strategy";
import { AwaitProfitStrategy } from "../strategy/sellAwaitProfitStrategy/awaitProfitStrategy.strategy";

......

 constructor(
        private botnest: BotNest
    ) {

    }
.......

  this.botnest.addStrategy(FillCellsStrategy);
  this.botnest.addStrategy(AwaitProfitStrategy);

......

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
