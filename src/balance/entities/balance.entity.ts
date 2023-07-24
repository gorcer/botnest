import { Column, Double, Entity, PrimaryGeneratedColumn } from "typeorm";

@Entity()
export class Balance {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({type: "int", nullable: true})
    user_id: number;    
    
    @Column("varchar")
    currency: string;    

    @Column("decimal")
    amount: number;

}
