import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { BotService } from './bot/bot.service';


async function bootstrap() {


    const app = await NestFactory.create(AppModule);

  const command = process.argv[2];

  switch (command) {
    case 'trade':
        const bot = await app.resolve(BotService);
        
        bot.setConfig({          
          pair: process.env.BOT_CURRENCY1 +'/'+ process.env.BOT_CURRENCY2,
          orderAmount: Number( process.env.BOT_ORDER_AMOUNT ),
          currency1: process.env.BOT_CURRENCY1,
          currency2: process.env.BOT_CURRENCY2,
          orderProbability: Number( process.env.BOT_ORDER_PROBABILITY ),
          minDailyProfit: Number(process.env.BOT_MIN_DAILY_PROFIT), // % годовых если сделка закрывается за день
          minYearlyProfit: Number(process.env.BOT_MIN_YERLY_PROFIT), // % годовых если сделка живет больше дня
          minBuyRateMarginToProcess: Number(process.env.BOT_MIN_BUY_RATE_MARGIN), // минимальное движение курса для проверки х100=%
          minSellRateMarginToProcess: Number(process.env.BOT_MIN_SELL_RATE_MARGIN), // минимальное движение курса для проверки х100=%
          sellFee:  Number(process.env.BOT_SELL_FEE),
          balanceSync: process.env.BOT_BALANCE_SYNC == 'true'
        });

        await bot.trade();

        break;   
  }
  await app.close();
  process.exit(0);
}

bootstrap();
