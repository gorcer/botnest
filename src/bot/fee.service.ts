import { Injectable } from "@nestjs/common";
import { ApiService } from "../exchange/api.service";
import { multiply } from "../helpers/bc";

@Injectable()
export class FeeService {


    constructor(
        private apiService: ApiService,
    ) { }


    async extractFee(
        api,
        feeObj: { cost: number; currency: string }[],
        currency2: string,
    ) {
        const fee = feeObj[0];
        const feeCost = feeObj[0]?.cost ?? 0;
        const feeInCurrency2Cost = await this.calculateFee(
            api,
            feeObj[0],
            currency2,
        );
        const feeCurrency = fee?.currency;

        return { feeCost, feeInCurrency2Cost, feeCurrency };
    }

    private async calculateFee(
        api,
        fee: { cost: number; currency: string },
        currency2: string,
    ) {
        if (!fee || !fee.cost || fee.cost == 0) return 0;

        if (!fee.currency) return fee.cost;

        if (fee.currency != currency2) {
            const pair = fee.currency + '/' + currency2;
            const lastPrice = await this.apiService.getLastPrice(api, pair);
            if (!lastPrice) {
                throw new Error('Unknown fee pair' + lastPrice);
            }

            return multiply(fee.cost, lastPrice);
        } else {
            return fee.cost;
        }
    }

}