import { MigrationInterface, QueryRunner } from "typeorm";

export class MakeMarketingConsentNullable1777539015473 implements MigrationInterface {
    name = 'MakeMarketingConsentNullable1777539015473'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "user" ALTER COLUMN "marketing_consent" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "user" ALTER COLUMN "marketing_consent" DROP DEFAULT`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "user" ALTER COLUMN "marketing_consent" SET DEFAULT false`);
        await queryRunner.query(`ALTER TABLE "user" ALTER COLUMN "marketing_consent" SET NOT NULL`);
    }

}
