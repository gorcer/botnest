import { Test, TestingModule } from '@nestjs/testing';
import { BotService } from './bot.service';
import { TestApiService } from '../binance/testapi.service';
import { LogService } from '../log.service';
import { notEqual } from 'assert';
import { OrderService } from '../order/order.service';
import { BalanceService } from '../balance/balance.service';
import { ConfigModule } from '@nestjs/config';
import { TestOrderService } from '../order/mock/testorder.service';
import { TestBalanceService } from '../balance/mock/testbalance.service';

describe('BotService', () => {
  let service: BotService;
  

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [        
        ConfigModule.forRoot(),    
      ],
      providers: [        
        BotService,
        LogService, 
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
          useClass: TestApiService        
        },        
      ],
    }).compile();

    service = module.get<BotService>(BotService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should create order', async () => {


    await service.syncData();   
    const result = await service.createBuyOrder(30000, 0.001);
    notEqual(result, false);
    if (result != false) {
      const {extOrder, order} = result;
      expect(extOrder.id).toBeDefined();
      expect(order.id).toBeDefined();
      // console.log(extOrder, order);
    }


  });
});
