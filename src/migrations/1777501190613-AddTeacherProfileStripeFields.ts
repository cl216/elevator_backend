import { MigrationInterface, QueryRunner } from "typeorm";

export class AddTeacherProfileStripeFields1777501190613 implements MigrationInterface {

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "teacher_profiles"
      ADD COLUMN IF NOT EXISTS "stripe_account_id" text,
      ADD COLUMN IF NOT EXISTS "stripe_onboarding_complete" boolean NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS "charges_enabled" boolean NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS "payouts_enabled" boolean NOT NULL DEFAULT false
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "teacher_profiles"
      DROP COLUMN IF EXISTS "payouts_enabled",
      DROP COLUMN IF EXISTS "charges_enabled",
      DROP COLUMN IF EXISTS "stripe_onboarding_complete",
      DROP COLUMN IF EXISTS "stripe_account_id"
    `);
  }

}
