import { NestFactory } from '@nestjs/core';
import { DaemonService } from './daemon.service';
import { BotnestModule } from './botnest.module';

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
    case 'test':
      {
        process.env.TZ = 'Asia/Vladivostok';
        const date = new Date();

        console.log( date );
      }
      break;
  }
  await app.close();
  process.exit(0);
}

bootstrap();
