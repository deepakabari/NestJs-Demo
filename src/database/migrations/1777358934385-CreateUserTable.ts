import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateUserTable1777358934385 implements MigrationInterface {
  name = 'CreateUserTable1777358934385';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."user_status_enum" AS ENUM('pending', 'processing', 'created')`,
    );
    await queryRunner.query(
      `CREATE TABLE "user" ("id" SERIAL NOT NULL, "email_hash" character varying NOT NULL, "email" character varying NOT NULL, "cognito_sub" character varying, "first_name" character varying, "last_name" character varying, "mnemonic" text, "status" "public"."user_status_enum" NOT NULL DEFAULT 'pending', "publicKey" character varying, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP, CONSTRAINT "UQ_ccfb95f77d4a0f791c0a2899395" UNIQUE ("email_hash"), CONSTRAINT "UQ_1e75d2289be8e3905810ff9b108" UNIQUE ("cognito_sub"), CONSTRAINT "PK_cace4a159ff9f2512dd42373760" PRIMARY KEY ("id"))`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "user"`);
    await queryRunner.query(`DROP TYPE "public"."user_status_enum"`);
  }
}
