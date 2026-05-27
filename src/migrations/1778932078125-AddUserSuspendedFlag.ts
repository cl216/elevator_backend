import { MigrationInterface, QueryRunner } from "typeorm";

export class AddUserSuspendedFlag1778932078125 implements MigrationInterface {
    name = 'AddUserSuspendedFlag1778932078125'

     public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users"
      ADD COLUMN IF NOT EXISTS "is_suspended"
      boolean NOT NULL DEFAULT false
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users"
      DROP COLUMN IF EXISTS "is_suspended"
    `);
  }

}
