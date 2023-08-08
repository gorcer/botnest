import {  BeforeInsert, Column, CreateDateColumn, Entity, Index, OneToMany, PrimaryGeneratedColumn } from "typeorm";
import { Order } from "../../order/entities/order.entity";


@Entity()
export class Pair {
    @PrimaryGeneratedColumn()
    id: number;
    
    @CreateDateColumn()
    createdAt: Date;

    @Index()
    @Column({type:"varchar",default:'BTC'})
    currency1: string;

    @Index()
    @Column({type:"varchar",default:'USDT'})
    currency2: string;

    @Column({type: "decimal", nullable: true})
    buyRate: number;
    
    @Column({type: "decimal", nullable: true})
    sellRate: number;
    
    @Column({type: "decimal", nullable: true})
    lastPrice: number;
    
    @Column({type: "boolean", default: true})
    isActive: boolean;

    // @OneToMany(() => Order, orders => orders.pair)
    // orders: Order[];

    
}
