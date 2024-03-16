import { Injectable } from '@nestjs/common';

@Injectable()
export class LogService {

  info(...args: any[]): void {
    console.log(args);
  }
  
  stat(...args: any[]): void {
    console.log(args);
  }
  
  error(...args: any[]): void {
    console.log(args);
  }  
  
  write(...args: any[]): void {
    console.log(args);
  }

}
