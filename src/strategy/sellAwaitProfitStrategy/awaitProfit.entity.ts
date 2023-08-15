import {  BeforeInsert, Column, CreateDateColumn, Entity, Index, JoinTable, ManyToOne, PrimaryGeneratedColumn } from "typeorm";
import { BaseStrategyModel } from "../baseStrategyModel.entity";

@Entity("strategy_sell_awaitProfit")
export class AwaitProfit extends BaseStrategyModel{

  

    @Column({type: "decimal", default: 200})
    minDailyProfit: number;
    
    @Column({type:"decimal", default: 30})
    minYerlyProfit:number;
    
}
