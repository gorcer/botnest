import { BeforeInsert, Column, CreateDateColumn, Entity, Index, OneToMany, PrimaryGeneratedColumn, UpdateDateColumn } from "typeorm";
import { Order } from "../../order/entities/order.entity";


@Entity()
export class Exchange {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ type: "varchar"})
    title: string;

    @Column({ type: "varchar"})
    alias: string;

    @Column({ type: "varchar"})
    exchange_name: string;

    @Column({ type: 'boolean', default: false })
    test_mode: boolean;
  
    @Column({ type: 'boolean', default: true })
    is_active: boolean;
}