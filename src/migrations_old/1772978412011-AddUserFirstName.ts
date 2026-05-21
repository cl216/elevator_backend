import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUserFirstName1773000000000 implements MigrationInterface {
  name = 'AddUserFirstName1773000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users"
      ADD COLUMN IF NOT EXISTS "first_name" text
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users"
      DROP COLUMN IF EXISTS "first_name"
    `);
  }
}
