import { NestFactory } from '@nestjs/core';
import { DaemonTradeService } from './example/daemonTrade.service';
import { InlineTradeService } from './example/inlineTrade.service';
import { ExampleModule } from './example.module';
import { AppModule } from './app.module';


async function bootstrap() {


  const app = await NestFactory.create(ExampleModule);

  const command = process.argv[2];

  switch (command) {
    case 'iterable':
      {
        const bot = await app.resolve(DaemonTradeService);
        await bot.trade();
      }
      break;
    case 'inline':
      {
        const bot = await app.resolve(InlineTradeService);
        await bot.trade();
      }
      break;
  }
  await app.close();
  process.exit(0);
}

bootstrap();
