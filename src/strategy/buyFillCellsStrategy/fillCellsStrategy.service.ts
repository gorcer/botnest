import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { FillCells } from "./fillCells.entity";
import { FillCellsStrategy } from "./fillCellsStrategy.strategy";
import { PairService } from "../../exchange/pair.service";
import { BalanceService } from "../../balance/balance.service";
import { extractCurrency } from "../../helpers/helpers";
import { add, multiply } from "../../helpers/bc";

@Injectable()
export class FillCellsStrategyService {
  exchanges = {};
  accounts = {};

  constructor(
    @InjectRepository(FillCells)
    private repository: Repository<FillCells>,
    private pairService: PairService,
    private balanceService: BalanceService
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
      const balance1 = await this.balanceService.getBalance(
        item.accountId,
        currency1
      );
      const balance2 = await this.balanceService.getBalance(
        item.accountId,
        currency2
      );
      const balance1InCurrency2Amount = multiply(
        balance1.in_orders,
        pair.sellRate
      );

      item.cellSize = FillCellsStrategy.calculateCellSize({
        totalBalance: add(balance1InCurrency2Amount, balance2.amount),
        pair,
        orderAmount: item.orderAmount,
        minRate: item.minRate
      });
      await this.repository.save(fillCells);
    }
  }
}
