import { Injectable } from '@nestjs/common';
import { writeFileSync } from 'node:fs';

@Injectable()
export class FileLogService {
  lastWrite = {};

  info(...args: any[]): void {
    this.write('info', args);
  }

  stat(...args: any[]): void {
    const message = new Date().toISOString() + ';' + args.join(';') + '\r\n';

    return writeFileSync(`./_log/stat.csv`, message, { flag: 'a+' });
  }

  error(...args: any[]): void {
    this.write('error', args);
  }

  write(type, args) {
    const message =
      new Date().toISOString() +
      ' (+' +
      (Date.now() - this.lastWrite[type]) / 1000 +
      ') ' +
      JSON.stringify(args) +
      '\r\n';
    this.lastWrite[type] = Date.now();

    if (process.env.LOG_OUTPUT == 'true') console.log(message);

    return writeFileSync(`./_log/${type}.log`, message, { flag: 'a+' });
  }
}
