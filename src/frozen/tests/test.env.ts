import { getRepositoryToken } from "@nestjs/typeorm";
import { BalanceService } from "../../balance/balance.service";
import { TestBalanceService } from "../../balance/mock/testbalance.service";
import { ApiService } from "../../exchange/api.service";
import { DummyExchange } from "../../exchange/mock/dummy.exchange";
import { TestOrderService } from "../../order/mock/testorder.service";
import { OrderService } from "../../order/order.service";
import { getDefaultTestEnv } from "../../test-utils/defaultTestEnv";
import { DefaultTestRepository } from "../../test-utils/DefaultTestRepository";
import { AccountService } from "../../user/account.service";
import { Frozen } from "../frozen.entity";
import { FrozenService } from "../frozen.service";

export async function getTestEnv() {

    const env = await getDefaultTestEnv({
        providers:

            [
                {
                    provide: getRepositoryToken(Frozen),
                    useClass: DefaultTestRepository,
                },
                {
                    provide: BalanceService,
                    useClass: TestBalanceService,
                },                
                DummyExchange,
                AccountService,
                ApiService,
                FrozenService
            ]
    }
    );

    const { module, api } = env;
    const frozenService = module.get<FrozenService>(FrozenService);

    return { frozenService, api };
};