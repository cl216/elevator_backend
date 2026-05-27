import { MigrationInterface, QueryRunner } from "typeorm";

export class AddRefundFailedToBookingStatus1774217402892 implements MigrationInterface {

public async up(queryRunner: QueryRunner): Promise<void> {
    const result = await queryRunner.query(`
      SELECT t.typname AS enum_name
      FROM pg_attribute a
      JOIN pg_class c ON c.oid = a.attrelid
      JOIN pg_type t ON t.oid = a.atttypid
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE c.relname = 'bookings'
        AND a.attname = 'status'
        AND t.typtype = 'e'
      LIMIT 1;
    `);

    const enumName = result?.[0]?.enum_name;

    if (!enumName) {
      throw new Error(
        'Could not find enum type for bookings.status. Migration aborted.',
      );
    }

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM pg_enum e
          JOIN pg_type t ON t.oid = e.enumtypid
          WHERE t.typname = '${enumName}'
            AND e.enumlabel = 'REFUND_FAILED'
        ) THEN
          EXECUTE 'ALTER TYPE "${enumName}" ADD VALUE ''REFUND_FAILED''';
        END IF;
      END
      $$;
    `);
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // PostgreSQL does not support removing a single enum value safely with a simple ALTER TYPE.
    // Leaving down migration empty intentionally.
  }
}
