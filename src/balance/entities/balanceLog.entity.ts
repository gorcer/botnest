import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from "typeorm";

export enum OperationType {
    INIT = "init",
    ACTUALIZE = "actualize",
    BUY = "buy",
    SELL = "sell",
    BUY_FEE = "buy_fee",
    SELL_FEE = "sell_fee"
}

@Entity()
export class BalanceLog {
    @PrimaryGeneratedColumn()
    id: number;
    
    @CreateDateColumn()
    createdAt: Date;

    @Column({type: "int"})
    accountId: number;    

    @Column({type: "int"})
    balanceId: number;    
    
    @Column({type: "int", nullable: true})
    sourceId: number;    
    
    @Column({
        type: "enum",
        enum: OperationType   
    })
    operationType: OperationType 

    @Column("decimal")
    amount: number;

    @Column("decimal")
    total: number;

}
