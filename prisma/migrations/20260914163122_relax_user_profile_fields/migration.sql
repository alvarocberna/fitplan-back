-- AlterTable
ALTER TABLE "public"."user" ALTER COLUMN "first_name" DROP NOT NULL,
ALTER COLUMN "paternal_last_name" DROP NOT NULL,
ALTER COLUMN "gender" DROP NOT NULL,
ALTER COLUMN "date_of_birth" DROP NOT NULL;
