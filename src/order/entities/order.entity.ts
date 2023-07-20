import { Column, Double, Entity, PrimaryGeneratedColumn } from "typeorm";

@Entity()
export class Order {
    @PrimaryGeneratedColumn()
    id: number;

    @Column()
    extOrderId: number;

    @Column("decimal")
    rate: Double;

    @Column()
    amount1: number;

    @Column()
    amount2: number;
}
