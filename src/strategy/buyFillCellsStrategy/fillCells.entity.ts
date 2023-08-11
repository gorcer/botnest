import {  BeforeInsert, Column, CreateDateColumn, Entity, Index, JoinTable, ManyToOne, PrimaryGeneratedColumn } from "typeorm";



@Entity("strategy_buy_fillCells")
export class FillCells {
    @PrimaryGeneratedColumn()
    id: number;
    
    @CreateDateColumn()
    createdAt: Date;

    @Index()
    @Column({type: "int", default: 1})    
    accountId: number;

    @Column({type: "decimal", default:0})
    risk: number;
    
    @Column({type: "decimal", default: 10})
    cellSize: number;

    @Column({type: "decimal", default: 0.001})
    orderAmount: number;
    
}
