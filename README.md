# Nest.JS + CCXT Trading Bot

This bot uses simple strategy:
1) Random buying a Bitcoin on Binance
2) Try to sell it in the current day with 300% anual profit
3) If it didn't happend try to sell with 30% anual profit on the next day and the ones after that
4) Buying will be close when the bot can sell it with 30% anual profit, it may takes one day, one week or ten years....
5) Anyway you guaranteed take your 30% anual profit, just be patient)

## Requirements:
1. API keys from one of supported in Ccxt exchanges
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


Fill settings in .env (BOT_TEST = false for production)

```
npm i
npm run execute trade
```

Enjoy


## Run test

```
npm test
```
