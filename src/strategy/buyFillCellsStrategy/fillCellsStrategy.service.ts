import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { FillCells } from "./fillCells.entity";
import { FillCellsStrategy } from "./fillCellsStrategy.strategy";
import { PairService } from "../../exchange/pair.service";
import { BalanceService } from "../../balance/balance.service";
import { extractCurrency } from "../../helpers/helpers";
import { add, multiply } from "../../helpers/bc";
import { FileLogService } from '../../log/filelog.service';

@Injectable()
export class FillCellsStrategyService {
  exchanges = {};
  accounts = {};

  constructor(
    @InjectRepository(FillCells)
    private repository: Repository<FillCells>,
    private pairService: PairService,
    private balanceService: BalanceService,
    private log: FileLogService,
  ) {
  }

  public async fetchOrCreate(accountId: number): Promise<FillCells> {
    let account = await this.repository.findOneBy({ accountId });
    if (!account) {
      account = this.repository.create({ accountId });
      await this.repository.save(account);
    }
    return account;
  }

  update(id: number, update) {
    return this.repository.update({ id }, update);
  }

  public async recalcCellSize(accountId: number) {
    const fillCells = await this.repository.findBy({ accountId });
    for (const item of fillCells) {
      const pair = await this.pairService.get(item.pairId);
      if (!pair) return;

      const { currency1, currency2 } = extractCurrency(pair.name);

      const balance2 = await this.balanceService.getBalance(
        item.accountId,
        currency2
      );

      item.cellSize = FillCellsStrategy.calculateCellSize({
        totalBalance:  balance2.amount,
        pair,
        orderAmount: item.orderAmount,
        minRate: item.minRate
      });

      this.log.info('Cell size has been recalculated, new value in '+item.cellSize);

      await this.repository.save(fillCells);
    }
  }
}
