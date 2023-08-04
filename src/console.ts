import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { BotService } from './bot/bot.service';
import { LonelyTraderService } from './bot/lonelyTrader.service';


async function bootstrap() {


  const app = await NestFactory.create(AppModule);

  const command = process.argv[2];

  switch (command) {
    case 'trade':
      const bot = await app.resolve(LonelyTraderService);
      await bot.trade();

      break;
  }
  await app.close();
  process.exit(0);
}

bootstrap();
