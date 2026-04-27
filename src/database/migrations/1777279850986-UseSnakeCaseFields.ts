import { MigrationInterface, QueryRunner } from 'typeorm';

export class UseSnakeCaseFields1777279850986 implements MigrationInterface {
  name = 'UseSnakeCaseFields1777279850986';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX \`IDX_a52e6213eabcdc108e26a4e9bb\` ON \`user\``);
    await queryRunner.query(`ALTER TABLE \`user\` DROP COLUMN \`cognitoSub\``);
    await queryRunner.query(`ALTER TABLE \`user\` DROP COLUMN \`createdAt\``);
    await queryRunner.query(`ALTER TABLE \`user\` DROP COLUMN \`deletedAt\``);
    await queryRunner.query(`ALTER TABLE \`user\` DROP COLUMN \`firstName\``);
    await queryRunner.query(`ALTER TABLE \`user\` DROP COLUMN \`lastName\``);
    await queryRunner.query(`ALTER TABLE \`user\` DROP COLUMN \`updatedAt\``);
    await queryRunner.query(`ALTER TABLE \`user\` ADD \`cognito_sub\` varchar(255) NULL`);
    await queryRunner.query(
      `ALTER TABLE \`user\` ADD UNIQUE INDEX \`IDX_1e75d2289be8e3905810ff9b10\` (\`cognito_sub\`)`,
    );
    await queryRunner.query(`ALTER TABLE \`user\` ADD \`first_name\` varchar(255) NULL`);
    await queryRunner.query(`ALTER TABLE \`user\` ADD \`last_name\` varchar(255) NULL`);
    await queryRunner.query(
      `ALTER TABLE \`user\` ADD \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6)`,
    );
    await queryRunner.query(
      `ALTER TABLE \`user\` ADD \`updated_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6)`,
    );
    await queryRunner.query(`ALTER TABLE \`user\` ADD \`deleted_at\` datetime(6) NULL`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE \`user\` DROP COLUMN \`deleted_at\``);
    await queryRunner.query(`ALTER TABLE \`user\` DROP COLUMN \`updated_at\``);
    await queryRunner.query(`ALTER TABLE \`user\` DROP COLUMN \`created_at\``);
    await queryRunner.query(`ALTER TABLE \`user\` DROP COLUMN \`last_name\``);
    await queryRunner.query(`ALTER TABLE \`user\` DROP COLUMN \`first_name\``);
    await queryRunner.query(`ALTER TABLE \`user\` DROP INDEX \`IDX_1e75d2289be8e3905810ff9b10\``);
    await queryRunner.query(`ALTER TABLE \`user\` DROP COLUMN \`cognito_sub\``);
    await queryRunner.query(
      `ALTER TABLE \`user\` ADD \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6)`,
    );
    await queryRunner.query(`ALTER TABLE \`user\` ADD \`lastName\` varchar(255) NULL`);
    await queryRunner.query(`ALTER TABLE \`user\` ADD \`firstName\` varchar(255) NULL`);
    await queryRunner.query(`ALTER TABLE \`user\` ADD \`deletedAt\` datetime(6) NULL`);
    await queryRunner.query(
      `ALTER TABLE \`user\` ADD \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6)`,
    );
    await queryRunner.query(`ALTER TABLE \`user\` ADD \`cognitoSub\` varchar(255) NULL`);
    await queryRunner.query(
      `CREATE UNIQUE INDEX \`IDX_a52e6213eabcdc108e26a4e9bb\` ON \`user\` (\`cognitoSub\`)`,
    );
  }
}
