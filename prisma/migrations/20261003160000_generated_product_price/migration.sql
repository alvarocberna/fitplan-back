-- Precio real del plan personalizado (producto GENERATED): 4.990 CLP. Solo datos, sin cambio de
-- esquema. Hasta ahora el backend creaba este producto al vuelo con un precio de relleno (19.990 CLP);
-- desde esta migración la fila `product` es la única fuente del precio (GET /plans/personalized y
-- order.amount) y el backend ya no la crea.
-- Las órdenes existentes no cambian: cada una guarda su propio `amount`.

-- Ambientes donde el producto ya existe: se corrige el precio.
UPDATE "public"."product"
SET "price" = 4990,
    "currency" = 'CLP',
    "name" = 'Plan Nutricional Personalizado',
    "updated_at" = CURRENT_TIMESTAMP
WHERE "type" = 'GENERATED' AND "active" = true;

-- Ambientes donde todavía no existe: se crea.
INSERT INTO "public"."product" ("type", "name", "description", "price", "currency", "active")
SELECT 'GENERATED',
       'Plan Nutricional Personalizado',
       'Plan nutricional generado automáticamente a partir de la consulta del paciente.',
       4990,
       'CLP',
       true
WHERE NOT EXISTS (
  SELECT 1 FROM "public"."product" WHERE "type" = 'GENERATED' AND "active" = true
);
