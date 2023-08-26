import { NestFactory } from '@nestjs/core';
import { ExampleDaemonTrader } from './example/exampleDaemon.trader';
import { ExampleInlineTrader } from './example/exampleInline.trader';
import { ExampleModule } from './example.module';


async function bootstrap() {


  const app = await NestFactory.create(ExampleModule.register());

  const command = process.argv[2];

  switch (command) {
    case 'iterable':
      {
        const bot = await app.resolve(ExampleDaemonTrader);
        await bot.trade();
      }
      break;
    case 'inline':
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
