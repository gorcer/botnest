import {  Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from "typeorm";

@Entity()
export class Account {
    @PrimaryGeneratedColumn()
    id: number;
    
    @CreateDateColumn()
    createdAt: Date;

    @Column("int")
    userId: number;

    @Column({type: "varchar", default: "binance"})
    exchangeName: string;    

    @Column({type: "boolean", default: false})
    testMode: boolean;    

    @Column({type: "varchar", nullable: true})
    apiKey: string;

    @Column({type: "varchar", nullable: true})
    secret: string;

    @Column({type:"boolean", default: true})
    isActive: boolean;
}
