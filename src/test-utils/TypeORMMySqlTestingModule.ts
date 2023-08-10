import { TypeOrmModule } from '@nestjs/typeorm';
import { BalanceLog } from '../balance/entities/balanceLog.entity';
import { Balance } from '../balance/entities/balance.entity';
import { Order } from '../order/entities/order.entity';
import { Pair } from '../exchange/entities/pair.entity';

export const TypeORMMySqlTestingModule = (entities: any[]) =>
  TypeOrmModule.forRoot({
    type: 'postgres',
    host: 'localhost',
    port: parseInt(process.env.DB_PORT),
    username: process.env.DB_LOGIN,
    password:  process.env.DB_PASS,
    database:  process.env.DB_NAME,
    entities: [Pair, Order, Balance, BalanceLog],
    synchronize: true,
  });