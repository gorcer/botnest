import { Injectable } from "@nestjs/common";
import { pro as ccxt } from "ccxt";
import { BaseApiService } from "./baseApi.service";

@Injectable()
export class ApiService extends BaseApiService {

    constructor() {
        
        super();

        const exchangeName = process.env.EXCHANGE_NAME;
        const exchangeClass = ccxt[exchangeName];

        if (process.env.BOT_TEST == 'true') {
            this.exchange = new exchangeClass({
                'apiKey': process.env.EXCHANGE_TESTNET_API_KEY,
                'secret': process.env.EXCHANGE_TESTNET_API_SECRET,
            });
            this.exchange.setSandboxMode(true);        
        } else {
            this.exchange = new exchangeClass({
                'apiKey': process.env.EXCHANGE_API_KEY,
                'secret': process.env.EXCHANGE_API_SECRET,
            });
        }

        
    }   


}

