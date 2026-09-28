//dtos
export * from './dtos/anamnesis-chat.dto';
export * from './dtos/consultation.dto';
export * from './dtos/nutrition-plan.dto';
export * from './dtos/order.dto';
export * from './dtos/product.dto';
//formulas
export * from './services/formulas/indexes/bmi.service';
export * from './services/formulas/skinfolds/skinfold-sum.service';
export * from './services/formulas/body-composition/muscle-mass.service';
export * from './services/formulas/body-composition/body-fat.service';
export * from './services/formulas/body-composition/mass-conversion.service';
export * from './services/formulas/phantom/phantom.service';
export * from './services/formulas/indexes/muscle-mass-index.service';
export * from './services/formulas/perimeters/corrected-girths.service';
export * from './services/formulas/requirements/supplements.service';
//utils
export * from './services/utils/age.service';
export * from './services/utils/predefined-plan-code';
export * from './services/formulas/requirements/requirements.service';

//measurements
export * from './services/measurements/measurement-results.calculator';

//objects
export * from './services/objects/r24h.object';

// dtos nuevos organizados por dominio (identity-auth / clinical-domain / commercial-domain,
// ver src/domain/dtos/); se va ampliando entidad por entidad a medida que se agregan sus
// datasources.

// identity-auth
export * from './dtos/identity-auth/user/create-user.dto';
export * from './dtos/identity-auth/user/update-user.dto';
export * from './dtos/identity-auth/user/find-or-create-user-by-email.dto';
export * from './dtos/identity-auth/auth-identity/create-auth-identity.dto';
export * from './dtos/identity-auth/auth-identity/update-auth-identity.dto';

// clinical-domain
export * from './dtos/clinical-domain/clinical-record/create-clinical-record.dto';
export * from './dtos/clinical-domain/clinical-record/update-clinical-record.dto';
export * from './dtos/clinical-domain/nutritional-consultation/create-nutritional-consultation.dto';
export * from './dtos/clinical-domain/nutritional-consultation/update-nutritional-consultation.dto';
export * from './dtos/clinical-domain/nutritional-consultation/create-nutritional-consultation-details.dto';
export * from './dtos/clinical-domain/anamnesis/create-anamnesis.dto';
export * from './dtos/clinical-domain/anamnesis/update-anamnesis.dto';
export * from './dtos/clinical-domain/goals/create-goals.dto';
export * from './dtos/clinical-domain/goals/update-goals.dto';
export * from './dtos/clinical-domain/anamnesis-clinical/create-anamnesis-clinical.dto';
export * from './dtos/clinical-domain/anamnesis-clinical/update-anamnesis-clinical.dto';
export * from './dtos/clinical-domain/clinical-condition/create-clinical-condition.dto';
export * from './dtos/clinical-domain/clinical-condition/update-clinical-condition.dto';
export * from './dtos/clinical-domain/anamnesis-dietary/create-anamnesis-dietary.dto';
export * from './dtos/clinical-domain/anamnesis-dietary/update-anamnesis-dietary.dto';
export * from './dtos/clinical-domain/dietary-recall-24h/create-dietary-recall-24h.dto';
export * from './dtos/clinical-domain/dietary-recall-24h/update-dietary-recall-24h.dto';
export * from './dtos/clinical-domain/dietary-recall-24h-meal/create-dietary-recall-24h-meal.dto';
export * from './dtos/clinical-domain/dietary-recall-24h-meal/update-dietary-recall-24h-meal.dto';
export * from './dtos/clinical-domain/food-preference/create-food-preference.dto';
export * from './dtos/clinical-domain/food-preference/update-food-preference.dto';
export * from './dtos/clinical-domain/food-preference-group/create-food-preference-group.dto';
export * from './dtos/clinical-domain/food-preference-group/update-food-preference-group.dto';
export * from './dtos/clinical-domain/supplements/create-supplements.dto';
export * from './dtos/clinical-domain/supplements/update-supplements.dto';
export * from './dtos/clinical-domain/anamnesis-psychosocial/create-anamnesis-psychosocial.dto';
export * from './dtos/clinical-domain/anamnesis-psychosocial/update-anamnesis-psychosocial.dto';
export * from './dtos/clinical-domain/lifestyle/create-lifestyle.dto';
export * from './dtos/clinical-domain/lifestyle/update-lifestyle.dto';
export * from './dtos/clinical-domain/sports-session/create-sports-session.dto';
export * from './dtos/clinical-domain/sports-session/update-sports-session.dto';
export * from './dtos/clinical-domain/sports-strategy/create-sports-strategy.dto';
export * from './dtos/clinical-domain/sports-strategy/update-sports-strategy.dto';
export * from './dtos/clinical-domain/measurements/create-measurements.dto';
export * from './dtos/clinical-domain/measurements/update-measurements.dto';
export * from './dtos/clinical-domain/measurements/measurement-details.dto';
export * from './dtos/clinical-domain/basic-measurements/create-basic-measurements.dto';
export * from './dtos/clinical-domain/basic-measurements/update-basic-measurements.dto';
export * from './dtos/clinical-domain/skinfolds/create-skinfolds.dto';
export * from './dtos/clinical-domain/skinfolds/update-skinfolds.dto';
export * from './dtos/clinical-domain/circumferences/create-circumferences.dto';
export * from './dtos/clinical-domain/circumferences/update-circumferences.dto';
export * from './dtos/clinical-domain/diameters/create-diameters.dto';
export * from './dtos/clinical-domain/diameters/update-diameters.dto';
export * from './dtos/clinical-domain/measurement-results/create-measurement-results.dto';
export * from './dtos/clinical-domain/measurement-results/update-measurement-results.dto';
export * from './dtos/clinical-domain/projection/create-projection.dto';
export * from './dtos/clinical-domain/projection/update-projection.dto';
export * from './dtos/clinical-domain/nutritional-plan/create-nutritional-plan.dto';
export * from './dtos/clinical-domain/nutritional-plan/update-nutritional-plan.dto';
export * from './dtos/clinical-domain/plan/create-plan.dto';
export * from './dtos/clinical-domain/plan/update-plan.dto';
export * from './dtos/clinical-domain/plan/upsert-plan-with-main-nutritional-plan.dto';
export * from './dtos/clinical-domain/plan-meal-time/create-plan-meal-time.dto';
export * from './dtos/clinical-domain/plan-meal-time/update-plan-meal-time.dto';
export * from './dtos/clinical-domain/plan-meal-time-note/create-plan-meal-time-note.dto';
export * from './dtos/clinical-domain/plan-meal-time-note/update-plan-meal-time-note.dto';
export * from './dtos/clinical-domain/plan-supplement/create-plan-supplement.dto';
export * from './dtos/clinical-domain/plan-supplement/update-plan-supplement.dto';
export * from './dtos/clinical-domain/plan-supplement-note/create-plan-supplement-note.dto';
export * from './dtos/clinical-domain/plan-supplement-note/update-plan-supplement-note.dto';
export * from './dtos/clinical-domain/plan-sports-recommendation/create-plan-sports-recommendation.dto';
export * from './dtos/clinical-domain/plan-sports-recommendation/update-plan-sports-recommendation.dto';

// commercial-domain
export * from './dtos/commercial-domain/product/create-product.dto';
export * from './dtos/commercial-domain/product/update-product.dto';
export * from './dtos/commercial-domain/order/create-order.dto';
export * from './dtos/commercial-domain/order/update-order.dto';
export * from './dtos/commercial-domain/payment/create-payment.dto';
export * from './dtos/commercial-domain/payment/update-payment.dto';
