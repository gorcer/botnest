import 'reflect-metadata';
import { DataSource, DataSourceOptions } from 'typeorm';

export const AppDataSource = new DataSource({
  type: process.env.DB_TYPE,  
  host: process.env.DB_HOST,
  port: process.env.DB_PORT
    ? parseInt(process.env.DB_PORT, 10)
    : 5432,
  username: process.env.DB_LOGIN,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  synchronize: false,
  dropSchema: false,
  keepConnectionAlive: true,
  logging: false,
  entities: [__dirname + '/../**/*.entity{.ts,.js}'],
  migrations: [__dirname + '/migrations/**/*{.ts,.js}'],
  cli: {
    entitiesDir: 'src',
    migrationsDir: 'src/database/migrations',
    subscribersDir: 'subscriber',
  },  
} as DataSourceOptions);