import { Test, TestingModule } from '@nestjs/testing';
import { Repository } from 'typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AccountService } from './account.service';
import { Account } from './entities/account.entity';

describe('OrderService', () => {
  let service: AccountService;
  let testOrderRepository = {
    create: (data) => {
      console.log('CREATE', data);
    }
  }

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AccountService,
        {
          provide: getRepositoryToken(Account),
          useValue: testOrderRepository,
        }
      ],
    }).compile();

    service = module.get<AccountService>(AccountService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

});
