import { NestFactory } from '@nestjs/core';
import { ExampleModule } from './example.module';
import { DaemonService } from './daemon.service';
import { BotnestModule } from './botnest.module';


async function bootstrap() {

  const app = await NestFactory.create(BotnestModule.register());

  const command = process.argv[2];

  switch (command) {
    case 'daemon':
      {
        const bot = await app.resolve(DaemonService);
        await bot.trade();
      }
      break;    
  }
  await app.close();
  process.exit(0);
}

bootstrap();
