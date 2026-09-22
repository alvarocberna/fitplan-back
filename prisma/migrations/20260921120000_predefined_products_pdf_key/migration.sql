-- Planes predefinidos: product.pdf_url pasa a llamarse pdf_key (guarda la key de S3, no una URL);
-- se conservan los datos existentes con RENAME (un drop+add de Prisma los perdería).
ALTER TABLE "public"."product" RENAME COLUMN "pdf_url" TO "pdf_key";

-- AlterTable
ALTER TABLE "public"."product" ADD COLUMN     "thumbnail_key" TEXT,
ADD COLUMN     "code" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "product_code_key" ON "public"."product"("code");

-- nutritional_plan.pdf_url nunca se leía (la fuente de verdad es order.pdf_key): se elimina.
ALTER TABLE "public"."nutritional_plan" DROP COLUMN "pdf_url";
