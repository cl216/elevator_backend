import { MigrationInterface, QueryRunner } from 'typeorm';

export class AutoMigration1772111869899 implements MigrationInterface {
  name = 'AutoMigration1772111869899';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1) Add column as NULLable first (existing rows won't break)
    await queryRunner.query(`
      ALTER TABLE "sessions"
      ADD COLUMN IF NOT EXISTS "end_time" TIMESTAMP NULL
    `);

    // 2) Backfill existing rows using start_time + duration (minutes)
await queryRunner.query(`
  UPDATE "sessions"
  SET "end_time" = "start_time" + ("duration_minutes" * interval '1 minute')
  WHERE "end_time" IS NULL
`);

    // 3) Enforce NOT NULL after backfill
    await queryRunner.query(`
      ALTER TABLE "sessions"
      ALTER COLUMN "end_time" SET NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "sessions"
      DROP COLUMN IF EXISTS "end_time"
    `);
  }
}
