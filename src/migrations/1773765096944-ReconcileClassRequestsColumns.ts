import { MigrationInterface, QueryRunner } from "typeorm";

export class ReconcileClassRequestsColumns1773765096944 implements MigrationInterface {

public async up(queryRunner: QueryRunner): Promise<void> {
    const hasRequestType = await queryRunner.query(`
      SELECT 1
      FROM information_schema.columns
      WHERE table_name = 'class_requests'
      AND column_name = 'request_type'
    `);

    if (hasRequestType.length === 0) {
      await queryRunner.query(`
        ALTER TABLE "class_requests"
        ADD COLUMN "request_type" character varying(30)
      `);

      await queryRunner.query(`
        UPDATE "class_requests"
        SET "request_type" = 'existing_category'
      `);

      await queryRunner.query(`
        ALTER TABLE "class_requests"
        ALTER COLUMN "request_type" SET NOT NULL
      `);
    }

    const hasCustomTitle = await queryRunner.query(`
      SELECT 1
      FROM information_schema.columns
      WHERE table_name = 'class_requests'
      AND column_name = 'custom_title'
    `);

    if (hasCustomTitle.length === 0) {
      await queryRunner.query(`
        ALTER TABLE "class_requests"
        ADD COLUMN "custom_title" character varying(80)
      `);
    }

    const hasReviewStatus = await queryRunner.query(`
      SELECT 1
      FROM information_schema.columns
      WHERE table_name = 'class_requests'
      AND column_name = 'review_status'
    `);

    if (hasReviewStatus.length === 0) {
      await queryRunner.query(`
        ALTER TABLE "class_requests"
        ADD COLUMN "review_status" character varying(20) NOT NULL DEFAULT 'pending'
      `);

      await queryRunner.query(`
        UPDATE "class_requests"
        SET "review_status" = 'approved'
        WHERE "request_type" = 'existing_category'
      `);
    }

    const categoryNullable = await queryRunner.query(`
      SELECT is_nullable
      FROM information_schema.columns
      WHERE table_name = 'class_requests'
      AND column_name = 'category'
    `);

    if (
      categoryNullable.length > 0 &&
      categoryNullable[0].is_nullable === 'NO'
    ) {
      await queryRunner.query(`
        ALTER TABLE "class_requests"
        ALTER COLUMN "category" DROP NOT NULL
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // intentionally conservative
    // do not drop columns in down because this migration is only repairing drift
  }
}
