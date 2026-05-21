import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateClassRequestsTable1773760057824 implements MigrationInterface {

 public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "class_requests" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "user_id" uuid NOT NULL,
        "category" character varying(50) NOT NULL,
        "note" text,
        "lat" double precision NOT NULL,
        "lng" double precision NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_class_requests_id" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      ALTER TABLE "class_requests"
      ADD CONSTRAINT "FK_class_requests_user_id"
      FOREIGN KEY ("user_id") REFERENCES "users"("id")
      ON DELETE NO ACTION
      ON UPDATE NO ACTION
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "class_requests" DROP CONSTRAINT "FK_class_requests_user_id"
    `);

    await queryRunner.query(`
      DROP TABLE "class_requests"
    `);
  }
}
