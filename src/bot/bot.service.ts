import { Injectable } from "@nestjs/common";
import binance from "ccxt/js/src/pro/binance";
import { BaseApiService } from "../binance/baseApi.service";

@Injectable()
export class BotService {
    
    pair:string;

constructor() {    
    this.pair = process.env.BOT_PAIR;
}

async trade(api:BaseApiService) {

    while(true) {
        const {bid, ask} = await api.getActualRates(this.pair);
        console.log(bid, ask);
    }

}

}