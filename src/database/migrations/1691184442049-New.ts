import { MigrationInterface, QueryRunner } from "typeorm";

export class New1691184442049 implements MigrationInterface {
    name = 'New1691184442049'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."order_side_enum" AS ENUM('buy', 'sell')`);
        await queryRunner.query(`CREATE TABLE "order" ("id" SERIAL NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "createdAtSec" integer NOT NULL, "accountId" integer NOT NULL DEFAULT '1', "extOrderId" character varying NOT NULL, "parentId" integer, "side" "public"."order_side_enum" NOT NULL DEFAULT 'buy', "currency1" character varying NOT NULL DEFAULT 'BTC', "currency2" character varying NOT NULL DEFAULT 'USDT', "rate" numeric NOT NULL, "expectedRate" numeric NOT NULL, "amount1" numeric NOT NULL, "amount2" numeric NOT NULL, "fee" numeric NOT NULL DEFAULT '0', "prefilled" numeric NOT NULL DEFAULT '0', "filled" numeric NOT NULL DEFAULT '0', "isActive" boolean NOT NULL DEFAULT true, "profit" numeric NOT NULL DEFAULT '0', "pair" character varying NOT NULL, CONSTRAINT "PK_1031171c13130102495201e3e20" PRIMARY KEY ("id")); COMMENT ON COLUMN "order"."prefilled" IS 'How much in close orders put'; COMMENT ON COLUMN "order"."filled" IS 'How much realy closed'`);
        await queryRunner.query(`CREATE INDEX "IDX_8cb9cecbc8b09bf60c71f7a968" ON "order" ("accountId") `);
        await queryRunner.query(`CREATE INDEX "IDX_b2c2d0a765399447a49159efe6" ON "order" ("parentId") `);
        await queryRunner.query(`CREATE INDEX "IDX_359fe9c15b5ecf17ce3473f2dd" ON "order" ("side") `);
        await queryRunner.query(`CREATE INDEX "IDX_34d5fd09e983d773185803fde6" ON "order" ("currency1") `);
        await queryRunner.query(`CREATE INDEX "IDX_def1840fbe955af866f53f1019" ON "order" ("currency2") `);
        await queryRunner.query(`CREATE INDEX "IDX_d8bb31fb4693a022c39888e41a" ON "order" ("rate", "createdAtSec", "amount1", "prefilled", "isActive") `);
        await queryRunner.query(`CREATE TABLE "balance" ("id" SERIAL NOT NULL, "accountId" integer NOT NULL DEFAULT '1', "currency" character varying NOT NULL, "amount" numeric NOT NULL, CONSTRAINT "PK_079dddd31a81672e8143a649ca0" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_7ee384741a490213486471471d" ON "balance" ("accountId") `);
        await queryRunner.query(`CREATE INDEX "IDX_bc03a07ccceb7ab56033b28f6c" ON "balance" ("currency") `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_bc03a07ccceb7ab56033b28f6c"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_7ee384741a490213486471471d"`);
        await queryRunner.query(`DROP TABLE "balance"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_d8bb31fb4693a022c39888e41a"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_def1840fbe955af866f53f1019"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_34d5fd09e983d773185803fde6"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_359fe9c15b5ecf17ce3473f2dd"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_b2c2d0a765399447a49159efe6"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_8cb9cecbc8b09bf60c71f7a968"`);
        await queryRunner.query(`DROP TABLE "order"`);
        await queryRunner.query(`DROP TYPE "public"."order_side_enum"`);
    }

}
