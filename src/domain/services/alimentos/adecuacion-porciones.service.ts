// PASO 2 y 3 DOC (adecuacion-porciones.md, secciones "2 - Se definen los alimentos (grupos de
// alimentos) de los tiempos de comida", "3 - Adecuación de grupos de alimentos" y "Pasos para generar
// el campo 'aporte'"): a partir de los tiempos de comida ya determinados (tiempos-comida.service.ts),
// primero se limpian los alimentos poco saludables reportados por el paciente (paso 2) y luego, tomando
// esa base, se calcula cuántas porciones de cada grupo de alimentos corresponden a cada tiempo de
// comida (campo "alimentos") y el aporte nutricional resultante de cada tiempo (campo "aporte").
//
// Esta lógica reemplaza lo que antes se le pedía calcular a la IA: las reglas del documento son
// completamente determinísticas, por lo que se implementan acá como código para que el resultado
// sea siempre reproducible.
import { Comida } from '../../dtos/consulta-completa.dto';
import { Requerimientos } from '../formulas/requerimientos.service';
import { PORCIONES_GRUPOS_ALIMENTOS, buscarGrupoAlimentos } from './porciones-alimentos';
import { TipoTiempo, esTiempoPrincipal, normalizarTiempo } from './tiempos-comida.service';
import { r24h1 } from '../objects/r24h.object';
import { r24hProcesado1 } from '../objects/r24h-procesado.object';
import { req1 } from '../objects/requerimientos.object';


// ---------------------------------------------------------------------------------------------
// PASO 2 - Se definen los alimentos (grupos de alimentos) de los tiempos de comida
// ---------------------------------------------------------------------------------------------

// Mismo shape que Comida, pero con los campos de alimentos convertidos a boolean: true si el
// paciente reportó ese grupo y se conserva como saludable/relevante para ese tiempo de comida,
// null si no fue reportado o si se eliminó por poco saludable / sin aporte real.
export type ComidaGrupos = {
    [K in keyof Comida]: K extends 'tiempo_de_comida' ? string | null : boolean | null;
};

type CampoAlimento = Exclude<keyof Comida, 'tiempo_de_comida'>;

const CAMPOS_ALIMENTO: CampoAlimento[] = [
    'carbohidrato',
    'verdura_libre_consumo',
    'verdura_consumo_general',
    'fruta',
    'proteina_alta_en_grasa',
    'proteina_baja_en_grasa',
    'lacteo_alto_en_grasa',
    'lacteo_medio_en_grasa',
    'lacteo_bajo_en_grasa',
    'lacteo_alto_en_proteina',
    'rico_en_lipidos',
    'aceite',
    'azucar',
    'alcohol',
];

// Alimentos que se consideran poco saludables o sin aporte real para cada tiempo de comida: se
// eliminan (pasan a null) sin importar lo que haya reportado el paciente.
const CAMPOS_ELIMINADOS_POR_TIEMPO: Record<TipoTiempo, CampoAlimento[]> = {
    desayuno: ['aceite', 'azucar'],
    once: ['aceite', 'azucar'],
    almuerzo: ['azucar'],
    cena: ['azucar'],
    colacion: ['aceite', 'azucar'],
};

// El alcohol nunca forma parte del cálculo de porciones (no existe grupo equivalente en
// PORCIONES_GRUPOS_ALIMENTOS): se elimina siempre, en todos los tiempos de comida.
const CAMPOS_ELIMINADOS_SIEMPRE: CampoAlimento[] = ['alcohol'];

export function definirGruposAlimentos(tiempos: Comida[]): ComidaGrupos[] {
    return tiempos.map((comida) => {
        const tipo = normalizarTiempo(comida.tiempo_de_comida);
        const eliminados = tipo ? CAMPOS_ELIMINADOS_POR_TIEMPO[tipo] : [];

        const resultado = { tiempo_de_comida: comida.tiempo_de_comida } as ComidaGrupos;
        for (const campo of CAMPOS_ALIMENTO) {
            const seElimina = CAMPOS_ELIMINADOS_SIEMPRE.includes(campo) || eliminados.includes(campo);
            resultado[campo] = !seElimina && Boolean(comida[campo]) ? true : null;
        }
        return resultado;
    });
}

//probando
// const resultado = definirGruposAlimentos(r24h1);
// console.log(resultado);

// ---------------------------------------------------------------------------------------------
// PASO 3 - Adecuación de grupos de alimentos + aporte
// ---------------------------------------------------------------------------------------------

export interface AlimentosTiempoCalculado {
    cereales: string | null;
    verduras_libre_consumo: string | null;
    verduras_consumo_general: string | null;
    frutas: string | null;
    proteinas_alta_en_grasa: string | null;
    proteinas_baja_en_grasa: string | null;
    lacteos_alto_en_grasa: string | null;
    lacteos_medio_en_grasa: string | null;
    lacteos_bajo_en_grasa: string | null;
    lacteos_alto_en_proteina: string | null;
    ricos_en_lipidos: string | null;
    aceites: string | null;
    azucares: string | null;
}

export interface AporteCalculado {
    calorias: number;
    proteina: number;
    carbohidrato: number;
    lipido: number;
}

// Mismo shape que AporteCalculado, pero con porcentajes de adecuación (ej 102.3 = 102.3%) en vez
// de valores absolutos. Ver calcularAdecuacionTotal.
export interface AdecuacionTotal {
    calorias: number;
    proteina: number;
    carbohidrato: number;
    lipido: number;
}

// Mismo shape que AlimentosTiempoCalculado, pero con el número de porciones exacto (float, sin
// redondear a cuartos ni formatear a texto) de cada grupo. "alimentos" (arriba) es para mostrarle
// el resultado a un humano/a la IA; este campo es para que el código pueda VALIDAR con precisión
// numérica los "componentes" que la IA reporte al generar los ejemplos (ver generacion-plan.service.ts,
// validarEjemplosGenerados). 0 si ese grupo no aplica a este tiempo de comida.
export interface PorcionesNumericasTiempo {
    cereales: number;
    verduras_libre_consumo: number;
    verduras_consumo_general: number;
    frutas: number;
    proteinas_alta_en_grasa: number;
    proteinas_baja_en_grasa: number;
    lacteos_alto_en_grasa: number;
    lacteos_medio_en_grasa: number;
    lacteos_bajo_en_grasa: number;
    lacteos_alto_en_proteina: number;
    ricos_en_lipidos: number;
    aceites: number;
    azucares: number;
}

export interface TiempoComidaCalculado {
    tiempo: TipoTiempo;
    aporte: AporteCalculado;
    alimentos: AlimentosTiempoCalculado;
    porcionesNumericas: PorcionesNumericasTiempo;
}

// Objeto devuelto por calcularAlimentosYAporte (ver adecuacion-porciones.md, paso 3): además de
// los tiempos de comida ya con sus porciones y aporte, incluye por separado el whey protein que
// haya sido necesario para cerrar el requerimiento de proteína (sección 3.1 del documento). El
// whey protein es un suplemento, no un alimento de un tiempo de comida puntual: por eso NO se
// adjunta al "aporte"/"alimentos" de ningún tiempo (aunque su aporte energético SÍ se descontó al
// calcular cuántas porciones de los demás grupos hacían falta), y se entrega acá aparte para que
// el promp de la IA lo agregue a la sección "suplementos" del plan.
export interface Adecuacion {
    adecuacion_porciones: TiempoComidaCalculado[];
    adecuacion_suplementos: string | null;
    // Aporte nutricional del whey protein de "adecuacion_suplementos" ({calorias:0,...} si no
    // aplica). Se entrega por separado (no sumado a ningún tiempo) para poder calcular el
    // porcentaje de adecuación TOTAL del plan (tiempos de comida + este suplemento) sin tener que
    // volver a derivar las porciones de whey a partir del string.
    aporte_suplementos: AporteCalculado;
}

// Tope de iteraciones de los bucles "ir añadiendo porciones hasta llegar al 100% de adecuación".
// Es una guarda defensiva: con requerimientos reales nunca se acerca a este número, pero evita
// que un dato corrupto (ej. requerimiento negativo o cero) cuelgue el cálculo en un loop infinito.
const MAX_ITERACIONES = 1000;

// 3.1 DOC: el requerimiento corregido de proteína corresponde al 85% del requerimiento calculado
// (el resto se completa con la proteína que aportan los otros grupos de alimentos más adelante).
const FACTOR_REQUERIMIENTO_CORREGIDO_PROTEINA = 0.85;

// Redondea un número de porciones a su representación de texto, ej 1 -> "1 porción",
// 2 -> "2 porciones", 0.5 -> "1/2 porción", 1.5 -> "1 1/2 porciones". Los aceites, al repartirse
// en partes iguales entre los tiempos que los llevan (ver distribución de aceites más abajo),
// pueden quedar en cuartos (ej 0.75 -> "3/4 porción"); por eso se redondea a la fracción de
// cuarto más cercana en vez de solo enteros/medios. null si no hay porciones.
function formatearPorciones(cantidad: number): string | null {
    if (!cantidad || cantidad <= 0) return null;
    const cuartos = Math.round(cantidad * 4);
    const entero = Math.floor(cuartos / 4);
    const restoCuartos = cuartos % 4;
    const FRACCIONES: Record<number, string> = { 1: '1/4', 2: '1/2', 3: '3/4' };
    const cantidadTexto = [entero > 0 ? `${entero}` : null, restoCuartos ? FRACCIONES[restoCuartos] : null]
        .filter(Boolean)
        .join(' ');
    const singular = cantidad <= 1;
    return `${cantidadTexto} ${singular ? 'porción' : 'porciones'}`;
}

// Reparte "cantidad" unidades de a una, en orden cíclico, entre los índices de cada fase, sin
// superar el "capMax" de esa fase para cada índice (el cap es acumulado entre fases: si un índice
// ya tiene 1 porción de una fase anterior y esta fase tiene capMax 2, puede recibir 1 más).
// Determina el comportamiento de distribución de todos los grupos de alimentos del documento
// (validado contra los ejemplos numéricos de adecuacion-porciones.md).
function distribuirRoundRobin(
    cantidad: number,
    fases: { indices: number[]; capMax: number }[],
    resultado: number[],
): void {
    let restante = cantidad;
    for (const fase of fases) {
        if (restante <= 0) break;
        let progreso = true;
        while (restante > 0 && progreso) {
            progreso = false;
            for (const idx of fase.indices) {
                if (restante <= 0) break;
                if (resultado[idx] < fase.capMax) {
                    resultado[idx] += 1;
                    restante -= 1;
                    progreso = true;
                }
            }
        }
    }
}

export function calcularAlimentosYAporte(
    tiempos: ComidaGrupos[],
    requerimientos: Requerimientos,
): Adecuacion {
    const n = tiempos.length;
    const tipos = tiempos.map((t) => normalizarTiempo(t.tiempo_de_comida) ?? 'colacion');
    const principalesIdx = tipos.map((t, i) => (esTiempoPrincipal(t) ? i : -1)).filter((i) => i >= 0);
    const colacionesIdx = tipos.map((t, i) => (!esTiempoPrincipal(t) ? i : -1)).filter((i) => i >= 0);
    const desayunoIdx = tipos.indexOf('desayuno');
    const almuerzoIdx = tipos.indexOf('almuerzo');
    const onceIdx = tipos.indexOf('once');
    const cenaIdx = tipos.indexOf('cena');
    const slotsAlmuerzoCena = [almuerzoIdx, cenaIdx].filter((i) => i >= 0);

    const gCereales = buscarGrupoAlimentos('Cereales', null);
    const gVerdurasLibre = buscarGrupoAlimentos('Verduras', 'Libre consumo');
    const gFrutas = buscarGrupoAlimentos('Frutas', null);
    const gProteinaBG = buscarGrupoAlimentos('Proteinas', 'Baja en grasa');
    const gLacteoMedio = buscarGrupoAlimentos('Lácteos', 'Medios en grasas');
    const gLacteoProtein = buscarGrupoAlimentos('Lácteos', 'Alto en proteina');
    const gRicos = buscarGrupoAlimentos('Ricos en lípidos', null);
    const gAceites = buscarGrupoAlimentos('Aceites y grasas', null);
    const gWhey = buscarGrupoAlimentos('Suplementos', 'proteina');

    // ---------------------------------------------------------------------------------------
    // 3.1 - Adecuación de proteína (conteo total del día; la distribución por tiempo se hace
    // más abajo, después de calcular los cereales, por la excepción de prioridad de lácteos que
    // depende de las porciones de cereal de cada colación).
    // ---------------------------------------------------------------------------------------
    const requerimientoCorregidoProteina = requerimientos.proteina * FACTOR_REQUERIMIENTO_CORREGIDO_PROTEINA;
    const limiteProteinaPorciones = 2 * principalesIdx.length;

    let porcionesProteina = 0;
    let porcionesLacteo = 0;
    let lacteoEsProtein = false;
    let wheyScoops = 0;
    let contadorPatron = 0;

    const totalProteinaGr = () =>
        porcionesProteina * gProteinaBG.aporte_por_porcion.proteina +
        porcionesLacteo * (lacteoEsProtein ? gLacteoProtein : gLacteoMedio).aporte_por_porcion.proteina +
        wheyScoops * gWhey.aporte_por_porcion.proteina;

    for (let iter = 0; iter < MAX_ITERACIONES && totalProteinaGr() < requerimientoCorregidoProteina; iter++) {
        contadorPatron++;
        if (contadorPatron % 4 === 0) {
            // El lácteo "debido" por el patrón se añade igual aunque ya se haya alcanzado el
            // límite: el límite del documento aplica solo a "porciones de proteina", no a lácteos.
            porcionesLacteo++;
        } else {
            if (porcionesProteina >= limiteProteinaPorciones) break;
            porcionesProteina++;
        }
    }

    if (totalProteinaGr() < requerimientoCorregidoProteina && porcionesLacteo > 0 && !lacteoEsProtein) {
        lacteoEsProtein = true;
    }
    if (totalProteinaGr() < requerimientoCorregidoProteina) {
        wheyScoops = 0.5;
    }
    if (totalProteinaGr() < requerimientoCorregidoProteina) {
        wheyScoops = 1;
    }
    for (let iter = 0; iter < MAX_ITERACIONES && totalProteinaGr() < requerimientoCorregidoProteina; iter++) {
        contadorPatron++;
        if (contadorPatron % 4 === 0) porcionesLacteo++;
        else porcionesProteina++;
    }

    // ---------------------------------------------------------------------------------------
    // 3.2 - Adecuación de carbohidrato
    // ---------------------------------------------------------------------------------------
    const gLacteoUsado = lacteoEsProtein ? gLacteoProtein : gLacteoMedio;
    const PORCIONES_VERDURA_LIBRE_FIJAS = 2;
    const carbsFromProteinaYLacteos =
        porcionesProteina * gProteinaBG.aporte_por_porcion.carbohidrato +
        porcionesLacteo * gLacteoUsado.aporte_por_porcion.carbohidrato +
        wheyScoops * gWhey.aporte_por_porcion.carbohidrato;
    const carbsFromVerduras =
        slotsAlmuerzoCena.length * PORCIONES_VERDURA_LIBRE_FIJAS * gVerdurasLibre.aporte_por_porcion.carbohidrato;

    const requerimientoCorregidoCarbohidrato = requerimientos.carbohidrato - carbsFromProteinaYLacteos;

    let porcionesCereal = 0;
    let porcionesFruta = 0;
    let totalCarb = carbsFromVerduras;
    for (let iter = 0; iter < MAX_ITERACIONES && totalCarb < requerimientoCorregidoCarbohidrato; iter++) {
        porcionesCereal++;
        totalCarb += gCereales.aporte_por_porcion.carbohidrato;
        if (porcionesCereal % 3 === 0) {
            porcionesFruta++;
            totalCarb += gFrutas.aporte_por_porcion.carbohidrato;
        }
    }

    // ---------------------------------------------------------------------------------------
    // 3.3 - Adecuación de lípidos. Orden: 1° rico en lípidos, 2° rico en lípidos, 3° 1/2 porción
    // de aceite, y así sucesivamente (por cada 2 porciones de rico en lípidos, 1/2 de aceite).
    // ---------------------------------------------------------------------------------------
    const lipidosFromOtrosGrupos =
        porcionesProteina * gProteinaBG.aporte_por_porcion.lipido +
        porcionesLacteo * gLacteoUsado.aporte_por_porcion.lipido +
        wheyScoops * gWhey.aporte_por_porcion.lipido +
        porcionesCereal * gCereales.aporte_por_porcion.lipido +
        porcionesFruta * gFrutas.aporte_por_porcion.lipido +
        slotsAlmuerzoCena.length * PORCIONES_VERDURA_LIBRE_FIJAS * gVerdurasLibre.aporte_por_porcion.lipido;

    const requerimientoCorregidoLipidos = requerimientos.lipido - lipidosFromOtrosGrupos;

    let porcionesRico = 0;
    let porcionesAceite = 0;
    let totalLip = 0;
    let contadorLipido = 0;
    for (let iter = 0; iter < MAX_ITERACIONES && totalLip < requerimientoCorregidoLipidos; iter++) {
        contadorLipido++;
        if (contadorLipido % 3 === 0) {
            porcionesAceite += 0.5;
            totalLip += gAceites.aporte_por_porcion.lipido * 0.5;
        } else {
            porcionesRico += 1;
            totalLip += gRicos.aporte_por_porcion.lipido;
        }
    }

    // ---------------------------------------------------------------------------------------
    // 3° - Distribución de las porciones calculadas en los tiempos de comida.
    // ---------------------------------------------------------------------------------------
    const porProteina = new Array(n).fill(0);
    distribuirRoundRobin(porcionesProteina, [
        { indices: principalesIdx, capMax: 2 },
        { indices: colacionesIdx.slice(0, 1), capMax: 2 },
        { indices: principalesIdx, capMax: Infinity },
    ], porProteina);

    const porCereales = new Array(n).fill(0);
    distribuirRoundRobin(porcionesCereal, [
        { indices: principalesIdx, capMax: 2 },
        { indices: colacionesIdx, capMax: 1 },
        { indices: colacionesIdx, capMax: 2 },
        { indices: principalesIdx, capMax: Infinity },
    ], porCereales);

    const prioridadFruta = [...colacionesIdx, almuerzoIdx, desayunoIdx, onceIdx, cenaIdx].filter((i) => i >= 0);
    const porFruta = new Array(n).fill(0);
    distribuirRoundRobin(porcionesFruta, [
        { indices: prioridadFruta, capMax: 1 },
        { indices: prioridadFruta, capMax: 2 },
        { indices: prioridadFruta, capMax: Infinity },
    ], porFruta);

    // Lácteos: solo van en Desayuno, Once y Colaciones (nunca Almuerzo/Cena). Si una colación
    // quedó con exactamente 1 porción de cereales, pasa a tener primera prioridad.
    const colacionesConUnCereal = colacionesIdx.filter((i) => porCereales[i] === 1);
    const colacionesSinExcepcion = colacionesIdx.filter((i) => porCereales[i] !== 1);
    const prioridadLacteo = [...colacionesConUnCereal, desayunoIdx, onceIdx, ...colacionesSinExcepcion].filter(
        (i) => i >= 0,
    );
    const porLacteo = new Array(n).fill(0);
    distribuirRoundRobin(porcionesLacteo, [
        { indices: prioridadLacteo, capMax: 1 },
        { indices: prioridadLacteo, capMax: 2 },
        { indices: prioridadLacteo, capMax: Infinity },
    ], porLacteo);

    const prioridadRicos = [desayunoIdx, ...colacionesIdx, onceIdx].filter((i) => i >= 0);
    const porRicos = new Array(n).fill(0);
    distribuirRoundRobin(porcionesRico, [
        { indices: prioridadRicos, capMax: 1 },
        { indices: prioridadRicos, capMax: Infinity },
    ], porRicos);

    const porAceite = new Array(n).fill(0);
    if (slotsAlmuerzoCena.length > 0 && porcionesAceite > 0) {
        const porSlot = porcionesAceite / slotsAlmuerzoCena.length;
        slotsAlmuerzoCena.forEach((i) => (porAceite[i] = porSlot));
    }

    // Whey protein (si aplica): es un suplemento, no un alimento de un tiempo de comida puntual,
    // por lo que NO se adjunta al "aporte"/"alimentos" de ningún tiempo. Su aporte energético sí
    // se descontó más arriba al calcular cuántas porciones de los demás grupos hacían falta (ver
    // carbsFromProteinaYLacteos, lipidosFromOtrosGrupos y totalCaloriasDia). Se entrega aparte en
    // "adecuacion_suplementos" para que la IA lo agregue a la sección "suplementos" del plan.
    const adecuacionSuplementos: string | null =
        wheyScoops > 0 ? `whey protein ${wheyScoops === 0.5 ? '1/2 scoop' : '1 scoop'}` : null;
    const aporteSuplementos: AporteCalculado = {
        calorias: wheyScoops * gWhey.aporte_por_porcion.energia,
        proteina: wheyScoops * gWhey.aporte_por_porcion.proteina,
        carbohidrato: wheyScoops * gWhey.aporte_por_porcion.carbohidrato,
        lipido: wheyScoops * gWhey.aporte_por_porcion.lipido,
    };

    // ---------------------------------------------------------------------------------------
    // 3.4 - Evaluar y corregir adecuación y distribución.
    //
    // Adecuación: el cálculo mecánico de 3.1-3.3 avanza macronutriente por macronutriente
    // ("hasta llegar al 100%/90-110% de CADA macro por separado"), pero las calorías totales del
    // día son la suma de los cuatro (proteína, lácteos, cereales, frutas, ricos en lípidos,
    // aceites), por lo que el resultado mecánico puede terminar por sobre el objetivo PRINCIPAL
    // del documento (calorías 95-105%) aunque cada macro por separado haya cerrado en su propio
    // rango. Para corregirlo, si las calorías totales exceden el 105% se retiran porciones (de a
    // una, recalculando cada vez) en orden de menor prioridad nutricional -aceites, ricos en
    // lípidos, frutas, cereales-, sin tocar proteína/lácteos (su objetivo de adecuación ya se
    // cumplió y es el más protegido); si quedan por debajo del 95% se agregan porciones de
    // cereales (el macro más flexible) al tiempo principal que tenga menos. No hay una regla
    // explícita en el documento sobre qué grupo específico ajustar acá: se prioriza así porque
    // son los últimos grupos en calcularse y los de menor relevancia nutricional relativa.
    // ---------------------------------------------------------------------------------------
    const calorias = (porciones: number, grupo: { aporte_por_porcion: { energia: number } }) =>
        porciones * grupo.aporte_por_porcion.energia;

    const totalCaloriasDia = (): number => {
        let total =
            slotsAlmuerzoCena.length * PORCIONES_VERDURA_LIBRE_FIJAS * gVerdurasLibre.aporte_por_porcion.energia +
            wheyScoops * gWhey.aporte_por_porcion.energia;
        for (let i = 0; i < n; i++) {
            total +=
                calorias(porCereales[i], gCereales) +
                calorias(porFruta[i], gFrutas) +
                calorias(porProteina[i], gProteinaBG) +
                calorias(porLacteo[i], gLacteoUsado) +
                calorias(porRicos[i], gRicos) +
                calorias(porAceite[i], gAceites);
        }
        return total;
    };

    // Se prioriza recortar primero el grupo que más aporta a los macros que ya están por sobre su
    // objetivo (carbohidrato y proteína suelen sobrepasarse primero, por el arrastre de cereales y
    // proteína/lácteos calculados en pasos previos), dejando los grupos que sostienen los lípidos
    // (ricos en lípidos, aceites) para el final: el lípido es el macro que más cuesta recuperar una
    // vez recortado, al tener el aporte por porción más bajo en relación al resto.
    const recursosAQuitar: { arr: number[]; paso: number }[] = [
        { arr: porCereales, paso: 1 },
        { arr: porFruta, paso: 1 },
        { arr: porRicos, paso: 1 },
        { arr: porAceite, paso: 0.5 },
    ];
    const quitarUnaUnidad = (): boolean => {
        for (const recurso of recursosAQuitar) {
            let idxElegido = -1;
            for (let i = 0; i < n; i++) {
                if (recurso.arr[i] >= recurso.paso && (idxElegido === -1 || recurso.arr[i] > recurso.arr[idxElegido])) {
                    idxElegido = i;
                }
            }
            if (idxElegido >= 0) {
                recurso.arr[idxElegido] -= recurso.paso;
                return true;
            }
        }
        return false;
    };

    const LIMITE_CORRECCION = 500;
    for (
        let iter = 0;
        iter < LIMITE_CORRECCION && totalCaloriasDia() > requerimientos.energia * 1.05 && quitarUnaUnidad();
        iter++
    );

    for (
        let iter = 0;
        iter < LIMITE_CORRECCION && totalCaloriasDia() < requerimientos.energia * 0.95 && principalesIdx.length > 0;
        iter++
    ) {
        const idxMinCereal = principalesIdx.reduce(
            (best, i) => (porCereales[i] < porCereales[best] ? i : best),
            principalesIdx[0],
        );
        porCereales[idxMinCereal] += 1;
    }

    // Distribución: todo tiempo de comida definido debe llevar algo. Si alguno quedó sin ningún
    // alimento, se desplaza 1 porción desde Desayuno u Once (1° ricos en lípidos, 2° fruta,
    // 3° lácteos).
    const tieneAlgo = (i: number): boolean =>
        porCereales[i] > 0 ||
        porFruta[i] > 0 ||
        porProteina[i] > 0 ||
        porLacteo[i] > 0 ||
        porRicos[i] > 0 ||
        porAceite[i] > 0 ||
        slotsAlmuerzoCena.includes(i);

    for (let idxVacio = 0; idxVacio < n; idxVacio++) {
        if (tieneAlgo(idxVacio)) continue;
        for (const origenIdx of [desayunoIdx, onceIdx].filter((idx) => idx >= 0 && idx !== idxVacio)) {
            if (porRicos[origenIdx] > 0) {
                porRicos[origenIdx] -= 1;
                porRicos[idxVacio] += 1;
                break;
            }
            if (porFruta[origenIdx] > 0) {
                porFruta[origenIdx] -= 1;
                porFruta[idxVacio] += 1;
                break;
            }
            if (porLacteo[origenIdx] > 0) {
                porLacteo[origenIdx] -= 1;
                porLacteo[idxVacio] += 1;
                break;
            }
        }
    }

    // ---------------------------------------------------------------------------------------
    // Ensamblado final: "alimentos" + "aporte" (sección "Pasos para generar el campo 'aporte'")
    // ---------------------------------------------------------------------------------------
    const adecuacion_porciones: TiempoComidaCalculado[] = tiempos.map((_, i) => {
        const alimentos: AlimentosTiempoCalculado = {
            cereales: formatearPorciones(porCereales[i]),
            verduras_libre_consumo: slotsAlmuerzoCena.includes(i)
                ? formatearPorciones(PORCIONES_VERDURA_LIBRE_FIJAS)
                : null,
            verduras_consumo_general: null,
            frutas: formatearPorciones(porFruta[i]),
            proteinas_alta_en_grasa: null,
            proteinas_baja_en_grasa: formatearPorciones(porProteina[i]),
            lacteos_alto_en_grasa: null,
            lacteos_medio_en_grasa: !lacteoEsProtein ? formatearPorciones(porLacteo[i]) : null,
            lacteos_bajo_en_grasa: null,
            lacteos_alto_en_proteina: lacteoEsProtein ? formatearPorciones(porLacteo[i]) : null,
            ricos_en_lipidos: formatearPorciones(porRicos[i]),
            aceites: formatearPorciones(porAceite[i]),
            azucares: null,
        };

        const porcionesNumericas: PorcionesNumericasTiempo = {
            cereales: porCereales[i],
            verduras_libre_consumo: slotsAlmuerzoCena.includes(i) ? PORCIONES_VERDURA_LIBRE_FIJAS : 0,
            verduras_consumo_general: 0,
            frutas: porFruta[i],
            proteinas_alta_en_grasa: 0,
            proteinas_baja_en_grasa: porProteina[i],
            lacteos_alto_en_grasa: 0,
            lacteos_medio_en_grasa: !lacteoEsProtein ? porLacteo[i] : 0,
            lacteos_bajo_en_grasa: 0,
            lacteos_alto_en_proteina: lacteoEsProtein ? porLacteo[i] : 0,
            ricos_en_lipidos: porRicos[i],
            aceites: porAceite[i],
            azucares: 0,
        };

        let aporte: AporteCalculado = { calorias: 0, proteina: 0, carbohidrato: 0, lipido: 0 };
        const sumar = (porciones: number, grupo: (typeof PORCIONES_GRUPOS_ALIMENTOS)[number]) => {
            if (!porciones) return;
            aporte = {
                calorias: aporte.calorias + porciones * grupo.aporte_por_porcion.energia,
                proteina: aporte.proteina + porciones * grupo.aporte_por_porcion.proteina,
                carbohidrato: aporte.carbohidrato + porciones * grupo.aporte_por_porcion.carbohidrato,
                lipido: aporte.lipido + porciones * grupo.aporte_por_porcion.lipido,
            };
        };
        sumar(porCereales[i], gCereales);
        sumar(slotsAlmuerzoCena.includes(i) ? PORCIONES_VERDURA_LIBRE_FIJAS : 0, gVerdurasLibre);
        sumar(porFruta[i], gFrutas);
        sumar(porProteina[i], gProteinaBG);
        sumar(porLacteo[i], gLacteoUsado);
        sumar(porRicos[i], gRicos);
        sumar(porAceite[i], gAceites);

        return {
            tiempo: tipos[i],
            aporte,
            alimentos,
            porcionesNumericas,
        };
    });

    return { adecuacion_porciones, adecuacion_suplementos: adecuacionSuplementos, aporte_suplementos: aporteSuplementos };
}

// Aporte nutricional TOTAL (valores absolutos) del plan: suma el aporte de todos los tiempos de
// comida más el aporte del suplemento de whey protein (si aplica) -NO incluye
// recomendaciones_deportivas ni otros suplementos (creatina, cafeina, nitrato, bicarbonato)-. Se
// expone como campo "aporte_plan.aporte_total" del PlanNutricionalDto (ver generacion-plan.service.ts).
export function calcularAporteTotalPlan(adecuacion: Adecuacion): AporteCalculado {
    return adecuacion.adecuacion_porciones.reduce(
        (acc, t) => ({
            calorias: acc.calorias + t.aporte.calorias,
            proteina: acc.proteina + t.aporte.proteina,
            carbohidrato: acc.carbohidrato + t.aporte.carbohidrato,
            lipido: acc.lipido + t.aporte.lipido,
        }),
        { ...adecuacion.aporte_suplementos },
    );
}

// Porcentaje de adecuación de "aporteTotal" (ver calcularAporteTotalPlan) en relación a los
// requerimientos calculados, por cada macronutriente. Se expone como campo
// "aporte_plan.adecuacion" del PlanNutricionalDto.
export function calcularAdecuacionTotal(aporteTotal: AporteCalculado, requerimientos: Requerimientos): AdecuacionTotal {
    const porcentaje = (aporte: number, requerido: number) => Math.round((aporte / requerido) * 1000) / 10;

    return {
        calorias: porcentaje(aporteTotal.calorias, requerimientos.energia),
        proteina: porcentaje(aporteTotal.proteina, requerimientos.proteina),
        carbohidrato: porcentaje(aporteTotal.carbohidrato, requerimientos.carbohidrato),
        lipido: porcentaje(aporteTotal.lipido, requerimientos.lipido),
    };
}

const resultadoAporte = calcularAlimentosYAporte(r24hProcesado1, req1);

console.log(resultadoAporte);