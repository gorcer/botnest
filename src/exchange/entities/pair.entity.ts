import { BeforeInsert, Column, CreateDateColumn, Entity, Index, OneToMany, PrimaryGeneratedColumn, UpdateDateColumn } from "typeorm";
import { Order } from "../../order/entities/order.entity";


@Entity()
export class Pair {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ type: 'integer', default: 1})
    exchange_id: number;

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn({ type: "timestamp", default: () => "CURRENT_TIMESTAMP(6)", onUpdate: "CURRENT_TIMESTAMP(6)" })
    updatedAt: Date;

    @Index()
    @Column({ type: "varchar", default: 'BTC/BUSD' })
    name: string;

    @Index()
    @Column({ type: "varchar", default: 'BTC' })
    currency1: string;

    @Index()
    @Column({ type: "varchar", default: 'BUSD' })
    currency2: string;

    @Column({ type: "decimal", nullable: true })
    buyRate: number;

    @Column({ type: "decimal", nullable: true })
    sellRate: number;

    @Column({ type: "decimal", nullable: true })
    lastPrice: number;

    @Column({ type: "decimal", nullable: true })
    minAmount1: number;

    @Column({ type: "decimal", nullable: true })
    minAmount2: number;

    @Column({ type: "boolean", default: true })
    isActive: boolean;

    @Column({ type: "decimal", nullable: true })
    fee: number;

    @Column({ type: "decimal", default: 13000 })
    historicalMinRate: number;

    // @OneToMany(() => Order, orders => orders.pair)
    // orders: Order[];


}
