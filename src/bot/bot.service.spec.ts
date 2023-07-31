import { Test, TestingModule } from '@nestjs/testing';
import { BotService } from './bot.service';
import { LogService } from '../log.service';
import { notEqual } from 'assert';
import { OrderService } from '../order/order.service';
import { BalanceService } from '../balance/balance.service';
import { ConfigModule } from '@nestjs/config';
import { TestOrderService } from '../order/mock/testorder.service';
import { TestBalanceService } from '../balance/mock/testbalance.service';
import { MockedApiService } from '../exchange/mock/mockedapi.service';
import { MockedExchange } from '../exchange/mock/mocked.exchange';

describe('BotService', () => {
  let service: BotService;
  let exchange:MockedExchange;
  

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [        
        ConfigModule.forRoot({
          envFilePath: '.test.env',
        }),    
      ],
      providers: [        
        BotService,
        LogService, 
        MockedApiService,
        MockedExchange,
        {
          provide: BalanceService,
          useClass: TestBalanceService,
        },       
        {
          provide: OrderService,
          useClass: TestOrderService,
        },
        {
          provide: 'API',
          useClass: MockedApiService
        },        
      ],
    }).compile();

    service = module.get<BotService>(BotService);
    const exchangeService = module.get<MockedApiService>(MockedApiService);
    exchange = exchangeService.getExchange();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should create order', async () => {

    exchange.setNextOrderBook(1000, 1001);
    exchange.setNextCreateOrder({      
      price: 1000,
      amount: 1,
      cost: 1000,
      fee: {
          cost: 0
      }
    });


    await service.syncData();   
    const result = await service.createBuyOrder(1000, 0.001);
    notEqual(result, false);
    if (result != false) {
      const {extOrder, order} = result;
      expect(extOrder.id).toBeDefined();
      expect(order.id).toBeDefined();
      // console.log(extOrder, order);
    }


  });
});
