import { Test, TestingModule } from '@nestjs/testing';
import { OrderService } from './order.service';
import { Repository } from 'typeorm';
import { Order } from './entities/order.entity';
import { getRepositoryToken } from '@nestjs/typeorm';

describe('OrderService', () => {
  let service: OrderService;
  let testOrderRepository = {
    create: (data) => {
      console.log('CREATE', data);
    }
  }

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrderService,
        {
          provide: getRepositoryToken(Order),
          useValue: testOrderRepository,
        }
      ],
    }).compile();

    service = module.get<OrderService>(OrderService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should create order', async () => {

    // jest.spyOn(orderRepository, 'find').mockResolvedValueOnce([]);

    // jest.spyOn(service, 'create').mockImplementation((data) => {
    //   console.log('CREATED', data);
    //   return (new Promise(()=>{}));
    // });

    // const order = service.create({
    //   extOrderId: "1",
    //   amount1: 10,
    //   amount2: 20,
    //   rate: 30000
    // });

    // console.log(order);
  });
});
