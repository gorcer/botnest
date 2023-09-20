import { Balance } from './balance/entities/balance.entity';
import { BalanceLog } from './balance/entities/balanceLog.entity';
import { Exchange } from './exchange/entities/exchange.entity';
import { Pair } from './exchange/entities/pair.entity';
import { Order } from './order/entities/order.entity';
import { FillCells } from './strategy/buyFillCellsStrategy/fillCells.entity';
import { AwaitProfit } from './strategy/sellAwaitProfitStrategy/awaitProfit.entity';
import { Account } from './user/entities/account.entity';

export const Entities = [
    FillCells,
    AwaitProfit,
    Order,
    Account,    
    Pair,
    Balance,
    BalanceLog,
    Exchange
]