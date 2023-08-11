import { TypeOrmModule } from '@nestjs/typeorm';
import { Entities } from '../all.entities';


export const TypeORMMySqlTestingModule = (entities: any[]) =>
  TypeOrmModule.forRoot({
    type: 'postgres',
    host: 'localhost',
    port: parseInt(process.env.DB_PORT),
    username: process.env.DB_LOGIN,
    password:  process.env.DB_PASS,
    database:  process.env.DB_NAME,
    entities: Entities,
    synchronize: true,
  });