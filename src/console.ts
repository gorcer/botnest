import { NestFactory } from '@nestjs/core';
import { DaemonService } from './daemon.service';
import { BotnestModule } from './botnest.module';
import { BotNest } from './bot/botnest.service';

async function bootstrap() {
  const app = await NestFactory.create(BotnestModule);

  const command = process.argv[2];

  switch (command) {
    case 'daemon':
      {
        const bot = await app.resolve(DaemonService);
        await bot.init();
        await bot.trade();
      }
      break;
    case 'checkBalance':
      {
        const accountId = Number(process.argv[3]);
        const botNest = await app.resolve(BotNest);
        const result = await botNest.checkBalance(accountId);
        console.log(result);
      }
      break;
    case 'test':
      {
        process.env.TZ = 'Europe/Moscow';
        const date = new Date();

        console.log(date);
      }
      break;
  }
  await app.close();
  process.exit(0);
}

bootstrap();
