import { Injectable } from "@nestjs/common";
import { OrderSide } from "ccxt/js/src/base/types";
import { Order, OrderType } from "../../order/entities/order.entity";

@Injectable()
export class MockedExchange {


    markets= [
        {
            symbol: 'BTC/USDT',
            limits: {
                amount: {
                    min: 0.000001
                },
                cost: {
                    min: 10
                }
            }
        }
    ];

    
    rownN=0;
    data=[];    
    
    orders=[];
    orderbook=[];
    lastOrderId=0;

   
    setNextOrderBook(bid:number, ask:number) {
        this.orderbook.push({
            bids: [ bid ],
            asks: [ ask ]
        });
    };

    watchOrderBook(pair, limit) {
        
        const current = this.orderbook.shift();
        if (!current) {
            return {
                bids:[],
                asks:[],
            }
        }        
        return current;
    };

    fetchMarkets() {
        return this.markets;
    };

    fetchBalance() {
        return {
            info: {
                balances: [
                    {
                        asset: 'BTC',
                        free: 1000
                    },
                    {
                        asset: 'USDT',
                        free: 1000
                    },
                ]
            }
        }
    };

    setNextOrder(order) {
        order.id = this.lastOrderId++;
        this.orders.push(order);        
    };

    createOrder(symbol:string, type:OrderType, side:OrderSide, amount:number, price?:number) {

        return this.orders.shift();
    }

    fetchOrder(id, pair):Order {
        return this.orders.shift();
    }

}
