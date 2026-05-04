import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateDeviceTokens1774353447344 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "device_tokens" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "user_id" uuid NOT NULL,
        "token" text NOT NULL,
        "platform" text,
        "device_id" text,
        "is_active" boolean NOT NULL DEFAULT true,
        "last_seen_at" TIMESTAMP,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_device_tokens_id" PRIMARY KEY ("id")
      )
    `);

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
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM information_schema.table_constraints
          WHERE constraint_name = 'FK_device_tokens_user_id'
          AND table_name = 'device_tokens'
        ) THEN
          ALTER TABLE "device_tokens"
          ADD CONSTRAINT "FK_device_tokens_user_id"
          FOREIGN KEY ("user_id") REFERENCES "users"("id")
          ON DELETE CASCADE
          ON UPDATE NO ACTION;
        END IF;
      END$$;
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
      DROP CONSTRAINT IF EXISTS "FK_device_tokens_user_id"
    `);

    await queryRunner.query(`
      DROP TABLE IF EXISTS "device_tokens"
    `);
  }
}