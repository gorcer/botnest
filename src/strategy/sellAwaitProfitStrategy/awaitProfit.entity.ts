import {  BeforeInsert, Column, CreateDateColumn, Entity, Index, JoinTable, ManyToOne, PrimaryGeneratedColumn } from "typeorm";

@Entity("strategy_sell_awaitProfit")
export class AwaitProfit {
    @PrimaryGeneratedColumn()
    id: number;
    
    @CreateDateColumn()
    createdAt: Date;

    @Index()
    @Column({type: "int", default: 1})    
    accountId: number;

    @Column({type: "decimal", default: 200})
    minDailyProfit: number;
    
    @Column({type:"decimal", default: 30})
    minYerlyProfit:number;
    
}
