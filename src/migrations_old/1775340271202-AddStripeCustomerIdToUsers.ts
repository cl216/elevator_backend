import { MigrationInterface, QueryRunner } from "typeorm";

export class AddStripeCustomerIdToUsers1775000000000 implements MigrationInterface {
  name = 'AddStripeCustomerIdToUsers1775000000000';
 
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users"
      ADD COLUMN IF NOT EXISTS "stripe_customer_id" text
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "idx_users_stripe_customer_id"
      ON "users" ("stripe_customer_id")
      WHERE "stripe_customer_id" IS NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS "idx_users_stripe_customer_id"
    `);

    await queryRunner.query(`
      ALTER TABLE "users"
      DROP COLUMN IF EXISTS "stripe_customer_id"
    `);
  }

}
