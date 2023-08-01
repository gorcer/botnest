import { Injectable } from "@nestjs/common";
import { BaseApiService } from "../baseApi.service";
import { MockedExchange } from "./mocked.exchange";

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

