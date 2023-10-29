import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { BuyOrderCreatedEvent } from '../events/buyorder-created.event';

@Injectable()
export class BuyOrderCreatedListener {
  @OnEvent('order.created')
  handleOrderCreatedEvent(event: BuyOrderCreatedEvent) {
    // handle and process "OrderCreatedEvent" event
    console.log(event);
  }
}