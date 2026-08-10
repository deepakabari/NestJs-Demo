import { MigrationInterface, QueryRunner } from "typeorm";

export class AddMarketingConsent1777538053274 implements MigrationInterface {
    name = 'AddMarketingConsent1777538053274'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "user" ADD "marketing_consent" boolean NOT NULL DEFAULT false`);
        await queryRunner.query(`ALTER TABLE "user" ADD "marketing_consent_at" TIMESTAMP`);
        await queryRunner.query(`CREATE INDEX "IDX_2d58d6e103583ad48fe30782d4" ON "user" ("status", "email") `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_2d58d6e103583ad48fe30782d4"`);
        await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "marketing_consent_at"`);
        await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "marketing_consent"`);
    }

}
