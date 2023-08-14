import {  BeforeInsert, Column, CreateDateColumn, Entity, Index, JoinTable, ManyToOne, PrimaryGeneratedColumn } from "typeorm";


@Entity()
export class User {
    @PrimaryGeneratedColumn()
    id: number;
    
    @CreateDateColumn()
    createdAt: Date;

    @Column("varchar")
    email: string;

    @Column("varchar")
    password: string;    

}
