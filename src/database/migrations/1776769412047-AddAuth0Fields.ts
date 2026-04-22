import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAuth0Fields1776769412047 implements MigrationInterface {
  name = 'AddAuth0Fields1776769412047';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`user\` ADD \`auth0Id\` varchar(255) NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE \`user\` ADD UNIQUE INDEX \`IDX_49c08de80c2fd2f6a7ba5ce97c\` (\`auth0Id\`)`,
    );
    await queryRunner.query(
      `ALTER TABLE \`user\` ADD \`emailVerified\` tinyint NOT NULL DEFAULT 0`,
    );
    await queryRunner.query(
      `ALTER TABLE \`user\` ADD \`lastLogin\` timestamp NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE \`user\` CHANGE \`email\` \`email\` varchar(255) NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE \`user\` CHANGE \`password\` \`password\` varchar(255) NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE \`user\` CHANGE \`name\` \`name\` varchar(255) NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`user\` CHANGE \`name\` \`name\` varchar(255) NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE \`user\` CHANGE \`password\` \`password\` varchar(255) NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE \`user\` CHANGE \`email\` \`email\` varchar(255) NOT NULL`,
    );
    await queryRunner.query(`ALTER TABLE \`user\` DROP COLUMN \`lastLogin\``);
    await queryRunner.query(
      `ALTER TABLE \`user\` DROP COLUMN \`emailVerified\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`user\` DROP INDEX \`IDX_49c08de80c2fd2f6a7ba5ce97c\``,
    );
    await queryRunner.query(`ALTER TABLE \`user\` DROP COLUMN \`auth0Id\``);
  }
}
