import { Injectable } from "@nestjs/common";
import { pro as ccxt } from "ccxt";
import { BaseApiService } from "./baseApi.service";

@Injectable()
export class ApiService extends BaseApiService {


    constructor() {
        
        super();

        this.exchange = new ccxt.binance({
            'apiKey': process.env.BINANCE_API_KEY,
            'secret': process.env.BINANCE_API_SECRET,
        });

        
    }   


}

