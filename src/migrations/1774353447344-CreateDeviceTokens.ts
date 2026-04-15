import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateDeviceTokens1774353447344 implements MigrationInterface {


  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "device_tokens"
      ADD COLUMN IF NOT EXISTS "platform" text
    `);

    await queryRunner.query(`
      ALTER TABLE "device_tokens"
      ADD COLUMN IF NOT EXISTS "device_id" text
    `);

    await queryRunner.query(`
      ALTER TABLE "device_tokens"
      ADD COLUMN IF NOT EXISTS "is_active" boolean NOT NULL DEFAULT true
    `);

    await queryRunner.query(`
      ALTER TABLE "device_tokens"
      ADD COLUMN IF NOT EXISTS "last_seen_at" TIMESTAMP
    `);

    await queryRunner.query(`
      ALTER TABLE "device_tokens"
      ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMP NOT NULL DEFAULT now()
    `);

    await queryRunner.query(`
      ALTER TABLE "device_tokens"
      ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMP NOT NULL DEFAULT now()
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_device_tokens_token_unique"
      ON "device_tokens" ("token")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_device_tokens_user_active"
      ON "device_tokens" ("user_id", "is_active")
    `);

    await queryRunner.query(`
      UPDATE "device_tokens"
      SET "is_active" = true
      WHERE "is_active" IS DISTINCT FROM true
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_device_tokens_user_active"
    `);

    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_device_tokens_token_unique"
    `);

    await queryRunner.query(`
      ALTER TABLE "device_tokens"
      DROP COLUMN IF EXISTS "updated_at"
    `);

    await queryRunner.query(`
      ALTER TABLE "device_tokens"
      DROP COLUMN IF EXISTS "created_at"
    `);

    await queryRunner.query(`
      ALTER TABLE "device_tokens"
      DROP COLUMN IF EXISTS "last_seen_at"
    `);

    await queryRunner.query(`
      ALTER TABLE "device_tokens"
      DROP COLUMN IF EXISTS "is_active"
    `);

    await queryRunner.query(`
      ALTER TABLE "device_tokens"
      DROP COLUMN IF EXISTS "device_id"
    `);

    await queryRunner.query(`
      ALTER TABLE "device_tokens"
      DROP COLUMN IF EXISTS "platform"
    `);
  }
}
