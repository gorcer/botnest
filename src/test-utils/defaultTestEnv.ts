import { CacheModule } from "@nestjs/cache-manager";
import { Provider } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { EventEmitterModule } from "@nestjs/event-emitter";
import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { DummyExchange } from "../exchange/mock/dummy.exchange";
import { FileLogService } from "../log/filelog.service";
import { SilentLogService } from "../log/silentlog.service";
import { AccountService } from "../user/account.service";
import { Account } from "../user/entities/account.entity";
import { DefaultTestRepository } from "./DefaultTestRepository";

export async function getDefaultTestEnv(options) {

    const account_id = 1;
    const user_id = 1;
    const {providers} = options;
    const modules = options.modules || [];            

    const module: TestingModule = await Test.createTestingModule({
        imports: [
            ...[
            EventEmitterModule.forRoot(),
            CacheModule.register(),
            ConfigModule.forRoot({
                envFilePath: '.test.env',
            })],
            ...modules         
        ],
        providers: [
            ...[
                {
                    provide: getRepositoryToken(Account),
                    useClass: DefaultTestRepository,
                },
                {
                    provide: FileLogService,
                    useClass: SilentLogService,
                },
            ],
            ...providers
                ],
    }).compile();

    
    const accountService = module.get<AccountService>(AccountService);
    const account = await accountService.fetchOrCreate(user_id);
    const api = new DummyExchange();
    // @todo
    // accountService.exchanges[account_id] = api;
    // accountService.accounts[account_id] = account;

    return { module, api };
};