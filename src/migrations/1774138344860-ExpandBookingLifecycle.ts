import { MigrationInterface, QueryRunner } from "typeorm";

export class ExpandBookingLifecycle1774138344860 implements MigrationInterface {

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1) Rename existing enum if it exists
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1
          FROM pg_type
          WHERE typname = 'bookings_status_enum'
        ) THEN
          ALTER TYPE "bookings_status_enum" RENAME TO "bookings_status_enum_old";
        END IF;
      END$$;
    `);

    // 2) Create new enum
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM pg_type
          WHERE typname = 'bookings_status_enum'
        ) THEN
          CREATE TYPE "bookings_status_enum" AS ENUM (
            'PENDING',
            'CONFIRMED',
            'CANCELLED_BY_LEARNER',
            'CANCELLED_BY_TEACHER',
            'REFUND_PENDING',
            'REFUNDED'
          );
        END IF;
      END$$;
    `);

    // 3) Convert existing status column to text first
    await queryRunner.query(`
      ALTER TABLE "bookings"
      ALTER COLUMN "status" DROP DEFAULT
    `);

    await queryRunner.query(`
      ALTER TABLE "bookings"
      ALTER COLUMN "status" TYPE text
    `);

    // 4) Backfill old CANCELLED -> CANCELLED_BY_LEARNER
    await queryRunner.query(`
      UPDATE "bookings"
      SET "status" = 'CANCELLED_BY_LEARNER'
      WHERE "status" = 'CANCELLED'
    `);

    // 5) Convert status column to new enum
    await queryRunner.query(`
      ALTER TABLE "bookings"
      ALTER COLUMN "status"
      TYPE "bookings_status_enum"
      USING "status"::"bookings_status_enum"
    `);

    await queryRunner.query(`
      ALTER TABLE "bookings"
      ALTER COLUMN "status" SET DEFAULT 'PENDING'
    `);

    // 6) Drop old enum if present
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1
          FROM pg_type
          WHERE typname = 'bookings_status_enum_old'
        ) THEN
          DROP TYPE "bookings_status_enum_old";
        END IF;
      END$$;
    `);

    // 7) Add lifecycle columns
    await queryRunner.query(`
      ALTER TABLE "bookings"
      ADD COLUMN IF NOT EXISTS "confirmed_at" TIMESTAMP NULL,
      ADD COLUMN IF NOT EXISTS "cancelled_at" TIMESTAMP NULL,
      ADD COLUMN IF NOT EXISTS "cancelled_by_user_id" uuid NULL,
      ADD COLUMN IF NOT EXISTS "refunded_at" TIMESTAMP NULL,
      ADD COLUMN IF NOT EXISTS "refund_amount" int NULL,
      ADD COLUMN IF NOT EXISTS "stripe_refund_id" text NULL
    `);

    // 8) Optional FK for cancelled_by_user_id
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM information_schema.table_constraints
          WHERE constraint_name = 'FK_bookings_cancelled_by_user_id'
          AND table_name = 'bookings'
        ) THEN
          ALTER TABLE "bookings"
          ADD CONSTRAINT "FK_bookings_cancelled_by_user_id"
          FOREIGN KEY ("cancelled_by_user_id") REFERENCES "users"("id")
          ON DELETE SET NULL
          ON UPDATE NO ACTION;
        END IF;
      END$$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "bookings"
      DROP CONSTRAINT IF EXISTS "FK_bookings_cancelled_by_user_id"
    `);

    await queryRunner.query(`
      ALTER TABLE "bookings"
      DROP COLUMN IF EXISTS "confirmed_at",
      DROP COLUMN IF EXISTS "cancelled_at",
      DROP COLUMN IF EXISTS "cancelled_by_user_id",
      DROP COLUMN IF EXISTS "refunded_at",
      DROP COLUMN IF EXISTS "refund_amount",
      DROP COLUMN IF EXISTS "stripe_refund_id"
    `);

    // Recreate old enum
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM pg_type
          WHERE typname = 'bookings_status_enum_old'
        ) THEN
          CREATE TYPE "bookings_status_enum_old" AS ENUM (
            'PENDING',
            'CONFIRMED',
            'CANCELLED'
          );
        END IF;
      END$$;
    `);

    await queryRunner.query(`
      ALTER TABLE "bookings"
      ALTER COLUMN "status" DROP DEFAULT
    `);

    await queryRunner.query(`
      ALTER TABLE "bookings"
      ALTER COLUMN "status" TYPE text
    `);

    await queryRunner.query(`
      UPDATE "bookings"
      SET "status" = 'CANCELLED'
      WHERE "status" IN (
        'CANCELLED_BY_LEARNER',
        'CANCELLED_BY_TEACHER',
        'REFUND_PENDING',
        'REFUNDED'
      )
    `);

    await queryRunner.query(`
      ALTER TABLE "bookings"
      ALTER COLUMN "status"
      TYPE "bookings_status_enum_old"
      USING "status"::"bookings_status_enum_old"
    `);

    await queryRunner.query(`
      ALTER TABLE "bookings"
      ALTER COLUMN "status" SET DEFAULT 'PENDING'
    `);

    await queryRunner.query(`
      DROP TYPE IF EXISTS "bookings_status_enum"
    `);

    await queryRunner.query(`
      ALTER TYPE "bookings_status_enum_old" RENAME TO "bookings_status_enum"
    `);
  }

}
