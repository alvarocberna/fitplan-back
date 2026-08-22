import { NutritionPlanDto } from '../../domain'

type MealTime = NutritionPlanDto['mealTimes'][number]
type MealTimeFoods = MealTime['foods']

// Claves de MealTimeFoods que representan grupos de alimentos.
// El orden de este arreglo define el orden en el que se listan los alimentos en el PDF.
// Para agregar o quitar una categoría de alimento del PDF, solo edita este arreglo.
export const FOOD_FIELDS: { key: keyof MealTimeFoods; label: string }[] = [
    { key: 'cereals', label: 'Cereales' },
    { key: 'freeConsumptionVegetables', label: 'Verdura de libre consumo' },
    { key: 'generalConsumptionVegetables', label: 'Verdura de consumo general' },
    { key: 'fruits', label: 'Fruta' },
    { key: 'highFatProteins', label: 'Proteína alta en grasa' },
    { key: 'lowFatProteins', label: 'Proteína baja en grasa' },
    { key: 'highFatDairy', label: 'Lácteo alto en grasa' },
    { key: 'mediumFatDairy', label: 'Lácteo medio en grasa' },
    { key: 'lowFatDairy', label: 'Lácteo bajo en grasa' },
    { key: 'highProteinDairy', label: 'Lácteo alto en proteína' },
    { key: 'highLipidFoods', label: 'Rico en lípidos' },
    { key: 'oils', label: 'Aceite' },
    { key: 'sugars', label: 'Azúcar' },
]

// Devuelve solo los grupos de alimentos que vienen con datos (no null) para un tiempo de comida dado.
// "value" es la porción (ej "2 porciones"); el campo "equivalence" de cada grupo (ver NutritionPlanDto)
// no se muestra en el PDF por ahora, pero queda disponible en mealTime.foods[key] si se necesita.
export function getFoods(mealTime: MealTime): { label: string; value: string }[] {
    return FOOD_FIELDS
        .filter(({ key }) => !!mealTime.foods[key])
        .map(({ key, label }) => ({ label, value: mealTime.foods[key]!.portion }))
}

// "desayuno" -> "Desayuno"
export function capitalize(text: string): string {
    if (!text) return text
    return text.charAt(0).toUpperCase() + text.slice(1)
}
