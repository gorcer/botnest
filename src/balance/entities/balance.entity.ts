import { Column, Double, Entity, Index, PrimaryGeneratedColumn } from "typeorm";

@Entity()
export class Balance {
    @PrimaryGeneratedColumn()
    id: number;

    @Index()
    @Column({type: "int", default: 1})
    accountId: number;    
    
    @Index()
    @Column("varchar")
    currency: string;    

    @Column("decimal")
    amount: number;

    @Column({type:"decimal", default: 0})
    inOrders: number;
}
