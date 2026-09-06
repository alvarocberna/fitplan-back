-- CreateTable
CREATE TABLE "public"."user" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "rut" TEXT,
    "rut_check_digit" TEXT,
    "email" TEXT,
    "first_name" TEXT NOT NULL,
    "middle_name" TEXT,
    "paternal_last_name" TEXT NOT NULL,
    "maternal_last_name" TEXT,
    "gender" TEXT NOT NULL,
    "date_of_birth" DATE NOT NULL,
    "photo_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."auth_identity" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "provider" TEXT NOT NULL,
    "provider_user_id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "email_verified" BOOLEAN NOT NULL,
    "is_primary" BOOLEAN NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "auth_identity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."clinical_record" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "patient_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "clinical_record_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."nutritional_consultation" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "clinical_record_id" UUID NOT NULL,
    "patient_id" UUID NOT NULL,
    "consultation_number" INTEGER NOT NULL,
    "consultation_date" TIMESTAMP(3) NOT NULL,
    "description" TEXT,
    "order_id" UUID,
    "athlete" BOOLEAN,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "nutritional_consultation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."anamnesis" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "consultation_id" UUID NOT NULL,

    CONSTRAINT "anamnesis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."goals" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "anamnesis_id" UUID NOT NULL,
    "main_goal" TEXT,
    "secondary_goal" TEXT[],

    CONSTRAINT "goals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."anamnesis_clinical" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "anamnesis_id" UUID NOT NULL,
    "pathology" TEXT[],
    "family_history" TEXT,
    "allergy" TEXT[],
    "intolerance" TEXT[],
    "medication" TEXT[],
    "gastrointestinal" TEXT[],
    "surgery" TEXT[],
    "bowel_movement" TEXT,
    "exams" TEXT,

    CONSTRAINT "anamnesis_clinical_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."clinical_condition" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "anamnesis_clinical_id" UUID NOT NULL,
    "name" TEXT,
    "detail" TEXT,
    "type" TEXT,
    "snomed_ct_code" TEXT,
    "status" TEXT,

    CONSTRAINT "clinical_condition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."anamnesis_dietary" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "anamnesis_id" UUID NOT NULL,
    "diet_type" TEXT,

    CONSTRAINT "anamnesis_dietary_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."dietary_recall_24h" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "anamnesis_dietary_id" UUID NOT NULL,

    CONSTRAINT "dietary_recall_24h_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."dietary_recall_24h_meal" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "dietary_recall_24h_id" UUID NOT NULL,
    "meal_time" TEXT NOT NULL,
    "meal_hour" TEXT NOT NULL,
    "carbohydrate" TEXT NOT NULL,
    "free_consumption_vegetable" TEXT NOT NULL,
    "general_consumption_vegetable" TEXT NOT NULL,
    "fruit" TEXT NOT NULL,
    "high_fat_protein" TEXT NOT NULL,
    "low_fat_protein" TEXT NOT NULL,
    "high_fat_dairy" TEXT NOT NULL,
    "medium_fat_dairy" TEXT NOT NULL,
    "low_fat_dairy" TEXT NOT NULL,
    "high_protein_dairy" TEXT NOT NULL,
    "lipid_rich" TEXT NOT NULL,
    "oil" TEXT NOT NULL,
    "sugar" TEXT NOT NULL,
    "alcohol" TEXT NOT NULL,

    CONSTRAINT "dietary_recall_24h_meal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."food_preference" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "anamnesis_dietary_id" UUID NOT NULL,
    "group" TEXT,

    CONSTRAINT "food_preference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."food_preference_group" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "food_preference_id" UUID NOT NULL,
    "group" TEXT,
    "frequent_consumption" TEXT[],
    "occasional_consumption" TEXT[],
    "rare_consumption" TEXT[],
    "avoided_foods" TEXT[],

    CONSTRAINT "food_preference_group_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."supplements" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "anamnesis_dietary_id" UUID NOT NULL,
    "supplement" TEXT NOT NULL,
    "quantity" TEXT,
    "frequency" TEXT,
    "detail" TEXT,

    CONSTRAINT "supplements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."anamnesis_psychosocial" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "anamnesis_id" UUID NOT NULL,
    "occupation" TEXT,
    "education" TEXT,
    "income" TEXT,
    "family_group" TEXT,

    CONSTRAINT "anamnesis_psychosocial_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."lifestyle" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "anamnesis_id" UUID NOT NULL,
    "tobacco" TEXT,
    "alcohol" TEXT,
    "physical_activity_level" TEXT,
    "sport" TEXT[],

    CONSTRAINT "lifestyle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."sports_session" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "lifestyle_id" UUID NOT NULL,
    "description" TEXT,
    "discipline" TEXT,
    "duration" INTEGER,
    "intensity" TEXT,
    "event_type" TEXT,
    "days" TEXT,
    "schedule" TEXT,

    CONSTRAINT "sports_session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."sports_strategy" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "lifestyle_id" UUID NOT NULL,
    "supplement" TEXT,
    "hydration" TEXT,
    "pre_activity_meal" TEXT,
    "during_activity_meal" TEXT,
    "post_activity_meal" TEXT,

    CONSTRAINT "sports_strategy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."measurements" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "consultation_id" UUID NOT NULL,
    "measurement_number" INTEGER NOT NULL,
    "level" TEXT,
    "description" TEXT,

    CONSTRAINT "measurements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."basic_measurements" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "measurements_id" UUID NOT NULL,
    "weight" DOUBLE PRECISION NOT NULL,
    "height" DOUBLE PRECISION NOT NULL,
    "sitting_height" DOUBLE PRECISION,
    "arm_span" DOUBLE PRECISION,

    CONSTRAINT "basic_measurements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."skinfolds" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "measurements_id" UUID NOT NULL,
    "triceps" DOUBLE PRECISION,
    "subscapular" DOUBLE PRECISION,
    "biceps" DOUBLE PRECISION,
    "iliac_crest" DOUBLE PRECISION,
    "supraspinal" DOUBLE PRECISION,
    "abdominal" DOUBLE PRECISION,
    "thigh" DOUBLE PRECISION,
    "calf" DOUBLE PRECISION,

    CONSTRAINT "skinfolds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."circumferences" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "measurements_id" UUID NOT NULL,
    "relaxed_arm" DOUBLE PRECISION,
    "flexed_arm" DOUBLE PRECISION,
    "waist" DOUBLE PRECISION,
    "hip" DOUBLE PRECISION,
    "mid_thigh" DOUBLE PRECISION,
    "calf" DOUBLE PRECISION,

    CONSTRAINT "circumferences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."diameters" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "measurements_id" UUID NOT NULL,
    "humerus" DOUBLE PRECISION,
    "bistyloid" DOUBLE PRECISION,
    "femur" DOUBLE PRECISION,

    CONSTRAINT "diameters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."measurement_results" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "measurements_id" UUID NOT NULL,
    "bmi" DOUBLE PRECISION,
    "bmi_classification" TEXT,
    "bf_formula" TEXT,
    "bf_kg" DOUBLE PRECISION,
    "bf_percentage" DOUBLE PRECISION,
    "bf_classification" TEXT,
    "vf_formula" TEXT,
    "vf_kg" DOUBLE PRECISION,
    "vf_percentage" DOUBLE PRECISION,
    "vf_classification" TEXT,
    "mm_formula" TEXT,
    "mm_kg" DOUBLE PRECISION,
    "mm_percentage" DOUBLE PRECISION,
    "mm_classification" TEXT,
    "mmi" DOUBLE PRECISION,
    "mmi_classification" TEXT,
    "endo" DOUBLE PRECISION,
    "meso" DOUBLE PRECISION,
    "ecto" DOUBLE PRECISION,
    "pha_weight" DOUBLE PRECISION,
    "pha_skinfold_triceps" DOUBLE PRECISION,
    "pha_skinfold_subscapular" DOUBLE PRECISION,
    "pha_skinfold_biceps" DOUBLE PRECISION,
    "pha_skinfold_iliac_crest" DOUBLE PRECISION,
    "pha_skinfold_supraspinal" DOUBLE PRECISION,
    "pha_skinfold_abdominal" DOUBLE PRECISION,
    "pha_skinfold_thigh" DOUBLE PRECISION,
    "pha_skinfold_calf" DOUBLE PRECISION,
    "pha_circumference_arm" DOUBLE PRECISION,
    "pha_circumference_arm_flexed" DOUBLE PRECISION,
    "pha_circumference_waist" DOUBLE PRECISION,
    "pha_circumference_hip" DOUBLE PRECISION,
    "pha_circumference_thigh" DOUBLE PRECISION,
    "pha_circumference_calf" DOUBLE PRECISION,
    "pha_diameter_humerus" DOUBLE PRECISION,
    "pha_diameter_bistyloid" DOUBLE PRECISION,
    "pha_diameter_femur" DOUBLE PRECISION,

    CONSTRAINT "measurement_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."nutritional_plan" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "consultation_id" UUID NOT NULL,
    "order_id" UUID,
    "goal" TEXT,
    "diet_regimen" TEXT,
    "calorie_requirement" DOUBLE PRECISION NOT NULL,
    "protein_requirement" DOUBLE PRECISION NOT NULL,
    "carbohydrate_requirement" DOUBLE PRECISION NOT NULL,
    "lipid_requirement" DOUBLE PRECISION NOT NULL,
    "calorie_intake" DOUBLE PRECISION NOT NULL,
    "protein_intake" DOUBLE PRECISION NOT NULL,
    "carbohydrate_intake" DOUBLE PRECISION NOT NULL,
    "lipid_intake" DOUBLE PRECISION NOT NULL,
    "pdf_url" TEXT,

    CONSTRAINT "nutritional_plan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."plan_meal_time" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "plan_id" UUID NOT NULL,
    "time" TEXT,
    "hour" TEXT,
    "calorie_intake" DOUBLE PRECISION NOT NULL,
    "protein_intake" DOUBLE PRECISION NOT NULL,
    "carbohydrate_intake" DOUBLE PRECISION NOT NULL,
    "fat_intake" DOUBLE PRECISION NOT NULL,
    "cereal" DOUBLE PRECISION,
    "free_consumption_vegetable" DOUBLE PRECISION,
    "general_consumption_vegetable" DOUBLE PRECISION,
    "fruit" DOUBLE PRECISION,
    "high_fat_protein" DOUBLE PRECISION,
    "low_fat_protein" DOUBLE PRECISION,
    "high_fat_dairy" DOUBLE PRECISION,
    "medium_fat_dairy" DOUBLE PRECISION,
    "low_fat_dairy" DOUBLE PRECISION,
    "high_protein_dairy" DOUBLE PRECISION,
    "lipid_rich" DOUBLE PRECISION,
    "oil" DOUBLE PRECISION,
    "sugar" DOUBLE PRECISION,

    CONSTRAINT "plan_meal_time_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."plan_meal_time_note" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "plan_meal_time_id" UUID NOT NULL,
    "note" TEXT NOT NULL,
    "type" TEXT NOT NULL,

    CONSTRAINT "plan_meal_time_note_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."plan_supplement" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "plan_id" UUID NOT NULL,
    "supplement" TEXT NOT NULL,
    "requirement" DOUBLE PRECISION,
    "dose_instructions" TEXT,
    "intake_instructions" TEXT,
    "calorie_intake" DOUBLE PRECISION NOT NULL,
    "protein_intake" DOUBLE PRECISION NOT NULL,
    "carbohydrate_intake" DOUBLE PRECISION NOT NULL,
    "fat_intake" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "plan_supplement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."plan_supplement_note" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "plan_supplement_id" UUID NOT NULL,
    "note" TEXT NOT NULL,
    "type" TEXT NOT NULL,

    CONSTRAINT "plan_supplement_note_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."plan_sports_recommendation" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "plan_id" UUID NOT NULL,
    "session" TEXT,
    "strategy" TEXT,
    "pre_activity" TEXT,
    "during_activity" TEXT,
    "post_activity" TEXT,

    CONSTRAINT "plan_sports_recommendation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."product" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "type" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "price" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL,
    "pdf_url" TEXT,
    "active" BOOLEAN NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."order" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL,
    "payment_status" TEXT NOT NULL DEFAULT 'pendiente',
    "generation_status" TEXT NOT NULL DEFAULT 'no_iniciado',
    "plan_json" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "creation_date" TIMESTAMP(3) NOT NULL,
    "payment_date" TIMESTAMP(3),
    "expiration_date" TIMESTAMP(3),

    CONSTRAINT "order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."payment" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "order_id" UUID NOT NULL,
    "provider" TEXT NOT NULL,
    "payment_identifier" TEXT NOT NULL,
    "authorization_code" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "installment_count" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "transaction_date" TIMESTAMP(3) NOT NULL,
    "movement_type" TEXT NOT NULL,
    "card_type" TEXT NOT NULL,

    CONSTRAINT "payment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_email_key" ON "public"."user"("email");

-- CreateIndex
CREATE UNIQUE INDEX "auth_identity_provider_provider_user_id_key" ON "public"."auth_identity"("provider", "provider_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "clinical_record_patient_id_key" ON "public"."clinical_record"("patient_id");

-- CreateIndex
CREATE UNIQUE INDEX "nutritional_consultation_order_id_key" ON "public"."nutritional_consultation"("order_id");

-- CreateIndex
CREATE UNIQUE INDEX "nutritional_plan_order_id_key" ON "public"."nutritional_plan"("order_id");

-- CreateIndex
CREATE UNIQUE INDEX "plan_supplement_plan_id_key" ON "public"."plan_supplement"("plan_id");

-- AddForeignKey
ALTER TABLE "public"."auth_identity" ADD CONSTRAINT "auth_identity_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."clinical_record" ADD CONSTRAINT "clinical_record_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "public"."user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."nutritional_consultation" ADD CONSTRAINT "nutritional_consultation_clinical_record_id_fkey" FOREIGN KEY ("clinical_record_id") REFERENCES "public"."clinical_record"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."nutritional_consultation" ADD CONSTRAINT "nutritional_consultation_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "public"."user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."nutritional_consultation" ADD CONSTRAINT "nutritional_consultation_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."anamnesis" ADD CONSTRAINT "anamnesis_consultation_id_fkey" FOREIGN KEY ("consultation_id") REFERENCES "public"."nutritional_consultation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."goals" ADD CONSTRAINT "goals_anamnesis_id_fkey" FOREIGN KEY ("anamnesis_id") REFERENCES "public"."anamnesis"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."anamnesis_clinical" ADD CONSTRAINT "anamnesis_clinical_anamnesis_id_fkey" FOREIGN KEY ("anamnesis_id") REFERENCES "public"."anamnesis"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."clinical_condition" ADD CONSTRAINT "clinical_condition_anamnesis_clinical_id_fkey" FOREIGN KEY ("anamnesis_clinical_id") REFERENCES "public"."anamnesis_clinical"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."anamnesis_dietary" ADD CONSTRAINT "anamnesis_dietary_anamnesis_id_fkey" FOREIGN KEY ("anamnesis_id") REFERENCES "public"."anamnesis"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."dietary_recall_24h" ADD CONSTRAINT "dietary_recall_24h_anamnesis_dietary_id_fkey" FOREIGN KEY ("anamnesis_dietary_id") REFERENCES "public"."anamnesis_dietary"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."dietary_recall_24h_meal" ADD CONSTRAINT "dietary_recall_24h_meal_dietary_recall_24h_id_fkey" FOREIGN KEY ("dietary_recall_24h_id") REFERENCES "public"."dietary_recall_24h"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."food_preference" ADD CONSTRAINT "food_preference_anamnesis_dietary_id_fkey" FOREIGN KEY ("anamnesis_dietary_id") REFERENCES "public"."anamnesis_dietary"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."food_preference_group" ADD CONSTRAINT "food_preference_group_food_preference_id_fkey" FOREIGN KEY ("food_preference_id") REFERENCES "public"."food_preference"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."supplements" ADD CONSTRAINT "supplements_anamnesis_dietary_id_fkey" FOREIGN KEY ("anamnesis_dietary_id") REFERENCES "public"."anamnesis_dietary"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."anamnesis_psychosocial" ADD CONSTRAINT "anamnesis_psychosocial_anamnesis_id_fkey" FOREIGN KEY ("anamnesis_id") REFERENCES "public"."anamnesis"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."lifestyle" ADD CONSTRAINT "lifestyle_anamnesis_id_fkey" FOREIGN KEY ("anamnesis_id") REFERENCES "public"."anamnesis"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."sports_session" ADD CONSTRAINT "sports_session_lifestyle_id_fkey" FOREIGN KEY ("lifestyle_id") REFERENCES "public"."lifestyle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."sports_strategy" ADD CONSTRAINT "sports_strategy_lifestyle_id_fkey" FOREIGN KEY ("lifestyle_id") REFERENCES "public"."lifestyle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."measurements" ADD CONSTRAINT "measurements_consultation_id_fkey" FOREIGN KEY ("consultation_id") REFERENCES "public"."nutritional_consultation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."basic_measurements" ADD CONSTRAINT "basic_measurements_measurements_id_fkey" FOREIGN KEY ("measurements_id") REFERENCES "public"."measurements"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."skinfolds" ADD CONSTRAINT "skinfolds_measurements_id_fkey" FOREIGN KEY ("measurements_id") REFERENCES "public"."measurements"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."circumferences" ADD CONSTRAINT "circumferences_measurements_id_fkey" FOREIGN KEY ("measurements_id") REFERENCES "public"."measurements"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."diameters" ADD CONSTRAINT "diameters_measurements_id_fkey" FOREIGN KEY ("measurements_id") REFERENCES "public"."measurements"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."measurement_results" ADD CONSTRAINT "measurement_results_measurements_id_fkey" FOREIGN KEY ("measurements_id") REFERENCES "public"."measurements"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."nutritional_plan" ADD CONSTRAINT "nutritional_plan_consultation_id_fkey" FOREIGN KEY ("consultation_id") REFERENCES "public"."nutritional_consultation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."nutritional_plan" ADD CONSTRAINT "nutritional_plan_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."plan_meal_time" ADD CONSTRAINT "plan_meal_time_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "public"."nutritional_plan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."plan_meal_time_note" ADD CONSTRAINT "plan_meal_time_note_plan_meal_time_id_fkey" FOREIGN KEY ("plan_meal_time_id") REFERENCES "public"."plan_meal_time"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."plan_supplement" ADD CONSTRAINT "plan_supplement_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "public"."nutritional_plan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."plan_supplement_note" ADD CONSTRAINT "plan_supplement_note_plan_supplement_id_fkey" FOREIGN KEY ("plan_supplement_id") REFERENCES "public"."plan_supplement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."plan_sports_recommendation" ADD CONSTRAINT "plan_sports_recommendation_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "public"."nutritional_plan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."order" ADD CONSTRAINT "order_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."order" ADD CONSTRAINT "order_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."payment" ADD CONSTRAINT "payment_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
