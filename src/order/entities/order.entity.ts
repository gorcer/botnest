import { AfterInsert, BeforeInsert, Column, CreateDateColumn, Double, Entity, PrimaryGeneratedColumn } from "typeorm";

export enum OrderType {
    BUY = "buy",
    SELL = "sell"
}


@Entity()
export class Order {
    @PrimaryGeneratedColumn()
    id: number;
    
    @CreateDateColumn()
    createdAt: Date;

    @Column("int")
    createdAtSec: number;

    @Column("int")
    extOrderId: string;
    
    @Column({type: "int", nullable: true})
    parentId: number;

    @Column({
        type: "enum",
        enum: OrderType,   
        default: OrderType.BUY     
    })
    type: OrderType

    @Column("decimal")
    rate: number;
    
    @Column("decimal")
    expectedRate:number;

    @Column("decimal")
    amount1: number;

    @Column("decimal")
    amount2: number;

    @Column({type: "decimal", default: 0, comment: "How much in close orders put"})
    prefilled: number;

    @Column({type: "decimal", default: 0, comment:"How much realy closed"})
    filled: number;

    @Column({type: "boolean", default: true})
    isActive: boolean;

    @Column({type: "decimal", default:0})
    profit: number;

    @BeforeInsert()
    beforeInsert() {
      if (this.type == OrderType.BUY) {
        this.filled = this.amount1;
      }
      this.createdAtSec = Math.floor(Date.now() / 1000)
    }

}
