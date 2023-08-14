import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { FillCells } from "./fillCells.entity";


@Injectable()
export class FillCellsStrategyService {

    exchanges = {};
    accounts = {};

    constructor(
        @InjectRepository(FillCells)
        private repository: Repository<FillCells>
    ) {

    }

    public async fetchOrCreate(accountId: number): Promise<FillCells> {
        let account = await this.repository.findOneBy({ accountId });
        if (!account) {
            account = this.repository.create({ accountId })
            await this.repository.save(
                account
            );
        }
        return account;
    }

    update(id: number, update) {
        return this.repository.update({ id }, update);
      }


}