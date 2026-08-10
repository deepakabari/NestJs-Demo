import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateSessionTable1777629019500 implements MigrationInterface {
    name = 'CreateSessionTable1777629019500'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "sessions" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "cognito_sub" character varying NOT NULL, "fingerprint_hash" character varying NOT NULL, "user_id" character varying, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_3238ef96f18b355b671619111bc" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_fe05fc5f47cc8a02d425e12b73" ON "sessions" ("cognito_sub") `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_fe05fc5f47cc8a02d425e12b73"`);
        await queryRunner.query(`DROP TABLE "sessions"`);
    }

}
