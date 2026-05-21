import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateCategoriesTable1773775535806 implements MigrationInterface {

 public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "categories" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "slug" character varying(50) NOT NULL,
        "label" character varying(80) NOT NULL,
        "status" character varying(20) NOT NULL DEFAULT 'approved',
        "created_by_user_id" uuid,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_categories_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_categories_slug" UNIQUE ("slug")
      )
    `);

    await queryRunner.query(`
      ALTER TABLE "categories"
      ADD CONSTRAINT "FK_categories_created_by_user_id"
      FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id")
      ON DELETE SET NULL
      ON UPDATE NO ACTION
    `);

    await queryRunner.query(`
      INSERT INTO "categories" ("slug", "label", "status")
      VALUES
        ('art', 'Art', 'approved'),
        ('music', 'Music', 'approved'),
        ('cooking', 'Cooking', 'approved'),
        ('language', 'Language', 'approved'),
        ('crafts', 'Crafts', 'approved')
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "categories"
      DROP CONSTRAINT "FK_categories_created_by_user_id"
    `);

    await queryRunner.query(`
      DROP TABLE "categories"
    `);
  }

}
