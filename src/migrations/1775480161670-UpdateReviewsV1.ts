import { MigrationInterface, QueryRunner } from "typeorm";

export class UpdateReviewsV11775480161670 implements MigrationInterface {
    name = 'UpdateReviewsV11775480161670'

    public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1
          FROM information_schema.tables
          WHERE table_schema = 'public'
            AND table_name = 'review'
        ) AND NOT EXISTS (
          SELECT 1
          FROM information_schema.tables
          WHERE table_schema = 'public'
            AND table_name = 'reviews'
        ) THEN
          ALTER TABLE "review" RENAME TO "reviews";
        END IF;
      END
      $$;
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "reviews" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "rating" integer NOT NULL,
        "comment" text,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "booking_id" uuid NOT NULL,
        "teacher_id" uuid NOT NULL,
        "learner_id" uuid NOT NULL,
        CONSTRAINT "PK_reviews_id" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      ALTER TABLE "reviews"
      ADD COLUMN IF NOT EXISTS "learner_id" uuid
    `);

    await queryRunner.query(`
      ALTER TABLE "reviews"
      ADD COLUMN IF NOT EXISTS "booking_id" uuid
    `);

    await queryRunner.query(`
      ALTER TABLE "reviews"
      ADD COLUMN IF NOT EXISTS "teacher_id" uuid
    `);

    await queryRunner.query(`
      ALTER TABLE "reviews"
      ALTER COLUMN "comment" DROP NOT NULL
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM pg_constraint
          WHERE conname = 'UQ_reviews_booking_id'
        ) THEN
          ALTER TABLE "reviews"
          ADD CONSTRAINT "UQ_reviews_booking_id" UNIQUE ("booking_id");
        END IF;
      END
      $$;
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM pg_constraint
          WHERE conname = 'FK_reviews_booking_id'
        ) THEN
          ALTER TABLE "reviews"
          ADD CONSTRAINT "FK_reviews_booking_id"
          FOREIGN KEY ("booking_id") REFERENCES "bookings"("id")
          ON DELETE CASCADE ON UPDATE NO ACTION;
        END IF;
      END
      $$;
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM pg_constraint
          WHERE conname = 'FK_reviews_teacher_id'
        ) THEN
          ALTER TABLE "reviews"
          ADD CONSTRAINT "FK_reviews_teacher_id"
          FOREIGN KEY ("teacher_id") REFERENCES "users"("id")
          ON DELETE NO ACTION ON UPDATE NO ACTION;
        END IF;
      END
      $$;
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM pg_constraint
          WHERE conname = 'FK_reviews_learner_id'
        ) THEN
          ALTER TABLE "reviews"
          ADD CONSTRAINT "FK_reviews_learner_id"
          FOREIGN KEY ("learner_id") REFERENCES "users"("id")
          ON DELETE NO ACTION ON UPDATE NO ACTION;
        END IF;
      END
      $$;
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_reviews_teacher_id"
      ON "reviews" ("teacher_id")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_reviews_learner_id"
      ON "reviews" ("learner_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_reviews_learner_id"
    `);

    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_reviews_teacher_id"
    `);

    await queryRunner.query(`
      ALTER TABLE "reviews" DROP CONSTRAINT IF EXISTS "FK_reviews_learner_id"
    `);

    await queryRunner.query(`
      ALTER TABLE "reviews" DROP CONSTRAINT IF EXISTS "FK_reviews_teacher_id"
    `);

    await queryRunner.query(`
      ALTER TABLE "reviews" DROP CONSTRAINT IF EXISTS "FK_reviews_booking_id"
    `);

    await queryRunner.query(`
      ALTER TABLE "reviews" DROP CONSTRAINT IF EXISTS "UQ_reviews_booking_id"
    `);

    await queryRunner.query(`
      ALTER TABLE "reviews" DROP COLUMN IF EXISTS "learner_id"
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1
          FROM information_schema.tables
          WHERE table_schema = 'public'
            AND table_name = 'reviews'
        ) AND NOT EXISTS (
          SELECT 1
          FROM information_schema.tables
          WHERE table_schema = 'public'
            AND table_name = 'review'
        ) THEN
          ALTER TABLE "reviews" RENAME TO "review";
        END IF;
      END
      $$;
    `);
  }
}
