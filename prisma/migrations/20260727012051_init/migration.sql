-- CreateTable
CREATE TABLE "orden" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "correo" TEXT NOT NULL,
    "payload_json" TEXT,
    "estado_pago" TEXT NOT NULL DEFAULT 'pendiente',
    "estado_generacion" TEXT NOT NULL DEFAULT 'no_iniciado',
    "plan_json" TEXT,
    "intentos" INTEGER NOT NULL DEFAULT 0,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);
