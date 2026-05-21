import { MigrationInterface, QueryRunner } from "typeorm";

export class AddBookingFeesAndDisputes1778952979758
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "bookings"
      ADD "lesson_amount" integer
    `);

    await queryRunner.query(`
      ALTER TABLE "bookings"
      ADD "platform_fee_amount" integer
    `);

    await queryRunner.query(`
      ALTER TABLE "bookings"
      ADD "stripe_fee_amount" integer
    `);

    await queryRunner.query(`
      ALTER TABLE "bookings"
      ADD "total_amount" integer
    `);

    await queryRunner.query(`
      ALTER TABLE "bookings"
      ADD "teacher_payout_amount" integer
    `);

    await queryRunner.query(`
      ALTER TABLE "bookings"
      ADD "completed_at" TIMESTAMP
    `);

    await queryRunner.query(`
      ALTER TABLE "bookings"
      ADD "disputed_at" TIMESTAMP
    `);

    await queryRunner.query(`
      ALTER TABLE "bookings"
      ADD "dispute_reason" text
    `);

    await queryRunner.query(`
      ALTER TABLE "bookings"
      ADD "learner_no_show_at" TIMESTAMP
    `);

    await queryRunner.query(`
      ALTER TABLE "bookings"
      ADD "teacher_no_show_at" TIMESTAMP
    `);

    await queryRunner.query(`
      ALTER TYPE "public"."bookings_status_enum"
      RENAME TO "bookings_status_enum_old"
    `);

    await queryRunner.query(`
      CREATE TYPE "public"."bookings_status_enum" AS ENUM(
        'PENDING',
        'CONFIRMED',
        'CANCELLED_BY_LEARNER',
        'CANCELLED_BY_TEACHER',
        'REFUND_PENDING',
        'REFUNDED',
        'REFUND_FAILED',
        'EXPIRED',
        'COMPLETED',
        'LEARNER_NO_SHOW',
        'TEACHER_NO_SHOW',
        'DISPUTED'
      )
    `);

    await queryRunner.query(`
      ALTER TABLE "bookings"
      ALTER COLUMN "status" DROP DEFAULT
    `);

    await queryRunner.query(`
      ALTER TABLE "bookings"
      ALTER COLUMN "status"
      TYPE "public"."bookings_status_enum"
      USING "status"::text::"public"."bookings_status_enum"
    `);

    await queryRunner.query(`
      ALTER TABLE "bookings"
      ALTER COLUMN "status" SET DEFAULT 'PENDING'
    `);

    await queryRunner.query(`
      DROP TYPE "public"."bookings_status_enum_old"
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "public"."bookings_status_enum_old" AS ENUM(
        'PENDING',
        'CONFIRMED',
        'CANCELLED_BY_LEARNER',
        'CANCELLED_BY_TEACHER',
        'REFUND_PENDING',
        'REFUNDED',
        'REFUND_FAILED',
        'EXPIRED'
      )
    `);

    await queryRunner.query(`
      ALTER TABLE "bookings"
      ALTER COLUMN "status" DROP DEFAULT
    `);

    await queryRunner.query(`
      ALTER TABLE "bookings"
      ALTER COLUMN "status"
      TYPE "public"."bookings_status_enum_old"
      USING "status"::text::"public"."bookings_status_enum_old"
    `);

    await queryRunner.query(`
      DROP TYPE "public"."bookings_status_enum"
    `);

    await queryRunner.query(`
      ALTER TYPE "public"."bookings_status_enum_old"
      RENAME TO "bookings_status_enum"
    `);

    await queryRunner.query(`
      ALTER TABLE "bookings"
      ALTER COLUMN "status" SET DEFAULT 'PENDING'
    `);

    await queryRunner.query(`
  ALTER TABLE "bookings"
  DROP COLUMN IF EXISTS "teacher_no_show_at"
`);

await queryRunner.query(`
  ALTER TABLE "bookings"
  DROP COLUMN IF EXISTS "learner_no_show_at"
`);

await queryRunner.query(`
  ALTER TABLE "bookings"
  DROP COLUMN IF EXISTS "dispute_reason"
`);

await queryRunner.query(`
  ALTER TABLE "bookings"
  DROP COLUMN IF EXISTS "disputed_at"
`);

await queryRunner.query(`
  ALTER TABLE "bookings"
  DROP COLUMN IF EXISTS "completed_at"
`);

await queryRunner.query(`
  ALTER TABLE "bookings"
  DROP COLUMN IF EXISTS "teacher_payout_amount"
`);

await queryRunner.query(`
  ALTER TABLE "bookings"
  DROP COLUMN IF EXISTS "total_amount"
`);

await queryRunner.query(`
  ALTER TABLE "bookings"
  DROP COLUMN IF EXISTS "stripe_fee_amount"
`);

await queryRunner.query(`
  ALTER TABLE "bookings"
  DROP COLUMN IF EXISTS "platform_fee_amount"
`);

await queryRunner.query(`
  ALTER TABLE "bookings"
  DROP COLUMN IF EXISTS "lesson_amount"
`);
  }
}