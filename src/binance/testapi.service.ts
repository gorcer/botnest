import { Injectable } from "@nestjs/common";
import { pro as ccxt } from "ccxt";
import { BaseApiService } from "./baseApi.service";

@Injectable()
export class TestApiService extends BaseApiService{


    constructor() {
        
        super();



        this.exchange = new ccxt.binance({
            'apiKey': process.env.BINANCE_TESTNET_API_KEY,
            'secret': process.env.BINANCE_TESTNET_API_SECRET,
        });
        this.exchange.setSandboxMode (true);        
    }
    


}

