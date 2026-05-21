import { MigrationInterface, QueryRunner } from "typeorm";

export class AddRereshTokenFieldsToUsers1775484838200 implements MigrationInterface {
    name = 'AddRereshTokenFieldsToUsers1775484838200'

    public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users"
      ADD COLUMN IF NOT EXISTS "refresh_token_hash" text
    `);

    await queryRunner.query(`
      ALTER TABLE "users"
      ADD COLUMN IF NOT EXISTS "refresh_token_expires_at" TIMESTAMP
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users"
      DROP COLUMN IF EXISTS "refresh_token_expires_at"
    `);

    await queryRunner.query(`
      ALTER TABLE "users"
      DROP COLUMN IF EXISTS "refresh_token_hash"
    `);
  }

}
