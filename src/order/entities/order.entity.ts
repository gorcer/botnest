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

    @Column({type: "decimal", default: 0})
    fill: number;

    @Column({type: "decimal", default:0})
    profit: number;

    @BeforeInsert()
    beforeInsert() {
      if (this.type == OrderType.BUY) {
        this.fill = this.amount1;
      }
      this.createdAtSec = Math.floor(Date.now() / 1000)
    }

}
