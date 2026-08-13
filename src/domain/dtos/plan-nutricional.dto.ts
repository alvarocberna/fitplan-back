import { SupplementPrescription } from '../services/formulas/suplementos.service';

// Un grupo de alimentos de un tiempo de comida: "porcion" es el texto ya calculado por código (ej "2
// porciones"); "equivalencia" son 3 alimentos alternativos de ese mismo grupo, cada uno ya escalado a
// esa misma cantidad de porciones (ej "pan 1/2 unidad (50gr), avena 1/2 taza (40gr), granola 1/2 taza
// (40gr)"), para que el paciente pueda sustituir el/los alimentos usados en "ejemplos" por otro
// equivalente del mismo grupo. Ver generacion-plan.service.ts (validarEquivalenciasGeneradas).
export interface AlimentoConEquivalencia {
    porcion: string
    equivalencia: string
}

export interface PlanNutricionalDto {
    informacion_personal: {
        nombre: string 
        apellido: string
        edad: string 
        fecha: string
    }
    prescripcion: {
        regimen: string
        objetivo: string
        calorias: number
        proteina: number
        carbohidrato: number
        lipido: number
    }
    // Aporte nutricional total del plan: suma de todos los tiempos_de_comida + suplemento de whey
    // protein (si aplica). NO incluye recomendaciones_deportivas ni otros suplementos (creatina,
    // cafeina, nitrato, bicarbonato).
    aporte_plan: {
        // Porcentaje de adecuación de "aporte_total" en relación a los requerimientos de "prescripcion".
        adecuacion: {
            calorias: number
            proteina: number
            carbohidrato: number
            lipido: number
        }
        // Mismos valores que "adecuacion", en términos absolutos.
        aporte_total: {
            calorias: number
            proteina: number
            carbohidrato: number
            lipido: number
        }
    }
    tiempos_de_comida: {
        description: {
            tiempo: string // desayuno | almuerzo | once | cena | colacion
            hora: string | null //ej 10am
        },
        aporte: {
            calorias: number 
            proteina: number 
            carbohidrato: number 
            lipido: number
        },
        alimentos: {
            cereales: AlimentoConEquivalencia | null
            verduras_libre_consumo: AlimentoConEquivalencia | null
            verduras_consumo_general: AlimentoConEquivalencia | null
            frutas: AlimentoConEquivalencia | null
            proteinas_alta_en_grasa: AlimentoConEquivalencia | null
            proteinas_baja_en_grasa: AlimentoConEquivalencia | null
            lacteos_alto_en_grasa: AlimentoConEquivalencia | null
            lacteos_medio_en_grasa: AlimentoConEquivalencia | null
            lacteos_bajo_en_grasa: AlimentoConEquivalencia | null
            lacteos_alto_en_proteina: AlimentoConEquivalencia | null
            ricos_en_lipidos: AlimentoConEquivalencia | null
            aceites: AlimentoConEquivalencia | null
            azucares: AlimentoConEquivalencia | null
        }
        ejemplos: string[] // 3 ejemplos
        comentarios: string[] 
    }[]
    // Cada SupplementPrescription incluye "aporte" (calorias, proteina, carbohidrato, lipido): 0
    // para creatina/cafeina/nitrato/bicarbonato, y el aporte real del whey protein cuando aplica
    // (ver adecuacion-porciones.service.ts / generacion-plan.prompts.ts).
    suplementos: SupplementPrescription[]
    recomendaciones_deportivas: {
        sesion: string | null //sesion de gimnasio
        estrategia: string | null //aportar energía para optimizar las sesiones de entrenamiento
        pre_actividad: string | null
        durante_actividad: string | null
        post_actividad: string | null
    }[]
}