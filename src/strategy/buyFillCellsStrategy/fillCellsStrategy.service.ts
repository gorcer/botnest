import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FillCells } from './fillCells.entity';
import { FillCellsStrategy } from './fillCellsStrategy.strategy';
import { PairService } from '../../exchange/pair.service';
import { BalanceService } from '../../balance/balance.service';
import { extractCurrency } from '../../helpers/helpers';

@Injectable()
export class FillCellsStrategyService {
  exchanges = {};
  accounts = {};

  constructor(
    @InjectRepository(FillCells)
    private repository: Repository<FillCells>,
    private pairService: PairService,
    private balanceService: BalanceService,
  ) {}

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

  public async recalcCellSize(id: number) {
    const obj = await this.repository.findOneBy({ id });
    const pair = await this.pairService.get(obj.pairId);
    if (!pair) return;

    const { currency2 } = extractCurrency(pair.name);
    const balance = await this.balanceService.getBalance(
      obj.accountId,
      currency2,
    );
    obj.cellSize = FillCellsStrategy.calculateCellSize({
      balance,
      pair,
      orderAmount: obj.orderAmount,
      risk: obj.risk,
    });
    await this.repository.save(obj);
  }
}
