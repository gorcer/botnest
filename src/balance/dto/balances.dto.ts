import { Double } from "typeorm";

export class BalancesDto {
    [currency: string]: number;
}
