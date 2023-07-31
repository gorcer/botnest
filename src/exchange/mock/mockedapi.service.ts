import { Injectable } from "@nestjs/common";
import { OrderSide } from "ccxt/js/src/base/types";
import { OrderType } from "../../order/entities/order.entity";
import { BaseApiService } from "../baseApi.service";
import { MockedExchange } from "./mocked.exchange";
import { getRatesFromFile } from "./rates";
const { multiply } = require( "js-big-decimal" );

@Injectable()
export class MockedApiService extends BaseApiService{
  
    constructor(
        public exchange: MockedExchange,    
    ) {        
        super();

    }

    getExchange() {
        return this.exchange;
    }
    


}

