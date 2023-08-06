import {  BeforeInsert, Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from "typeorm";

export enum OrderSideEnum {
    BUY = 'buy',
    SELL = 'sell',
  }

@Entity()
@Index(['rate','createdAtSec','amount1','prefilled','isActive'])
export class Order {
    @PrimaryGeneratedColumn()
    id: number;
    
    @CreateDateColumn()
    createdAt: Date;

    @Column("int")
    createdAtSec: number;   

    @Index()
    @Column({type: "int", default: 1})    
    accountId: number;

    @Column("varchar")
    extOrderId: string;
    
    @Index()
    @Column({type: "int", nullable: true})
    parentId: number;

    @Index()
    @Column({
        type: "enum",
        enum: OrderSideEnum,   
        default: OrderSideEnum.BUY     
    })
    side: OrderSideEnum

    @Index()
    @Column({type:"varchar",default:'BTC'})
    currency1: string;

    @Index()
    @Column({type:"varchar",default:'USDT'})
    currency2: string;

    @Column("decimal")
    rate: number;
    
    @Column("decimal")
    expectedRate:number;
    
    @Column("decimal")
    amount1: number;

    @Column("decimal")
    amount2: number;

    @Column({type: "decimal", default:0})
    fee: number;

    @Column({type: "decimal", default: 0, comment: "How much in close orders put"})
    prefilled: number;

    @Column({type: "decimal", default: 0, comment:"How much realy closed"})
    filled: number;
    
    @Column({type: "boolean", default: true})
    isActive: boolean;

    @Column({type: "decimal", default:0})
    profit: number;
    
    @Column({type: "decimal", default:0})
    profitPc: number;

    get pair(): string {        
        return this.currency1 + '/' + this.currency2;
    }
    
    @BeforeInsert()
    beforeInsert() {
      // if (this.type == OrderType.BUY) {
      //   this.filled = this.amount1;
      // }
      this.createdAtSec = Math.floor(Date.now() / 1000)
    }

}
