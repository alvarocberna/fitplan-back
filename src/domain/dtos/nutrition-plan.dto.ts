import { SupplementPrescription } from '../services/formulas/requirements/supplements.service';

// Un grupo de alimentos de un tiempo de comida: "portion" es el texto ya calculado por código (ej "2
// porciones"); "equivalence" son 3 alimentos alternativos de ese mismo grupo, cada uno ya escalado a
// esa misma cantidad de porciones (ej "pan 1/2 unidad (50gr), avena 1/2 taza (40gr), granola 1/2 taza
// (40gr)"), para que el paciente pueda sustituir el/los alimentos usados en "examples" por otro
// equivalente del mismo grupo. Ver plan-generation.service.ts (validateGeneratedEquivalences).
export interface FoodWithEquivalence {
    portion: string
    equivalence: string
}

export interface NutritionPlanDto {
    personalInfo: {
        name: string
        lastName: string
        age: string
        date: string
    }
    prescription: {
        regimen: string
        goal: string
        calories: number
        protein: number
        carbohydrate: number
        fat: number
    }
    // Aporte nutricional total del plan: suma de todos los mealTimes + suplemento de whey
    // protein (si aplica). NO incluye sportsRecommendations ni otros suplementos (creatina,
    // cafeina, nitrato, bicarbonato).
    planIntake: {
        // Porcentaje de adecuación de "totalIntake" en relación a los requerimientos de "prescription".
        adequacy: {
            calories: number
            protein: number
            carbohydrate: number
            fat: number
        }
        // Mismos valores que "adequacy", en términos absolutos.
        totalIntake: {
            calories: number
            protein: number
            carbohydrate: number
            fat: number
        }
    }
    mealTimes: {
        description: {
            time: string // desayuno | almuerzo | once | cena | colacion
            hour: string | null //ej 10am
        },
        intake: {
            calories: number
            protein: number
            carbohydrate: number
            fat: number
        },
        foods: {
            cereals: FoodWithEquivalence | null
            freeConsumptionVegetables: FoodWithEquivalence | null
            generalConsumptionVegetables: FoodWithEquivalence | null
            fruits: FoodWithEquivalence | null
            highFatProteins: FoodWithEquivalence | null
            lowFatProteins: FoodWithEquivalence | null
            highFatDairy: FoodWithEquivalence | null
            mediumFatDairy: FoodWithEquivalence | null
            lowFatDairy: FoodWithEquivalence | null
            highProteinDairy: FoodWithEquivalence | null
            highLipidFoods: FoodWithEquivalence | null
            oils: FoodWithEquivalence | null
            sugars: FoodWithEquivalence | null
        }
        examples: string[] // 3 ejemplos
        comments: string[]
    }[]
    // Cada SupplementPrescription incluye "intake" (calories, protein, carbohydrate, fat): 0
    // para creatina/cafeina/nitrato/bicarbonato, y el aporte real del whey protein cuando aplica
    // (ver adecuacion-porciones.service.ts / generacion-plan.prompts.ts).
    supplements: SupplementPrescription[]
    sportsRecommendations: {
        session: string | null //sesion de gimnasio
        strategy: string | null //aportar energía para optimizar las sesiones de entrenamiento
        preActivity: string | null
        duringActivity: string | null
        postActivity: string | null
    }[]
}
