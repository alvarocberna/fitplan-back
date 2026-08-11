
// PASO 1 DOC (adecuacion-porciones.md, sección "1 - Se definen los tiempos de comida")
// Determina, de forma determinística, los tiempos de comida finales del plan a partir del r24h que el
// paciente reportó, completando (con entradas vacías) los tiempos que falten según el objetivo. El
// contenido reportado por el paciente en los tiempos ya existentes se preserva tal cual: este paso solo
// decide CUÁNTOS y CUÁLES tiempos de comida habrá y en qué orden, no qué alimentos llevan (eso lo decide
// el paso 2, ver definirGruposAlimentos en adecuacion-porciones.service.ts).

import { Comida } from '../../dtos/consulta-completa.dto';

export type TipoTiempo = 'desayuno' | 'almuerzo' | 'once' | 'cena' | 'colacion';

// Etiqueta con la que se escribe cada tiempo en el campo "tiempo_de_comida" del objeto devuelto.
const ETIQUETA_TIEMPO: Record<TipoTiempo, string> = {
    desayuno: 'desayuno',
    almuerzo: 'almuerzo',
    once: 'once',
    cena: 'cena',
    colacion: 'colación',
};

// Orden canónico de los tiempos principales: se usa tanto para completar los que falten (se
// añade "el primero de la lista que falta") como para ordenar el resultado final.
const ORDEN_PRINCIPALES: TipoTiempo[] = ['desayuno', 'almuerzo', 'once', 'cena'];

// Se normaliza el valor de 'tiempo_de_comida'
export function normalizarTiempo(raw: string | null | undefined): TipoTiempo | null {
    if (!raw) return null;
    const t = raw.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim();
    if (t.includes('desayuno')) return 'desayuno';
    if (t.includes('almuerzo')) return 'almuerzo';
    if (t.includes('once')) return 'once';
    if (t.includes('cena')) return 'cena';
    if (t.includes('colacion')) return 'colacion';
    return null;
}

export function esTiempoPrincipal(tipo: TipoTiempo): boolean {
    return tipo !== 'colacion';
}

function comidaVacia(tipo: TipoTiempo): Comida {
    return {
        tiempo_de_comida: ETIQUETA_TIEMPO[tipo],
        carbohidrato: null,
        verdura_libre_consumo: null,
        verdura_consumo_general: null,
        fruta: null,
        proteina_alta_en_grasa: null,
        proteina_baja_en_grasa: null,
        lacteo_alto_en_grasa: null,
        lacteo_medio_en_grasa: null,
        lacteo_bajo_en_grasa: null,
        lacteo_alto_en_proteina: null,
        rico_en_lipidos: null,
        aceite: null,
        azucar: null,
        alcohol: null,
    };
}

// Elige en qué "hueco" (gap) entre tiempos principales consecutivos va cada colación a agregar.
// El objeto ConsultaCompletaDto no registra la hora de los tiempos de comida (Comida no tiene
// campo "hora"), por lo que no es posible aplicar la regla de "la ventana de tiempo superior"
// del documento. En su lugar se usa como default el hueco medio entre principales, que es el
// resultado que da el propio ejemplo del documento (Desayuno 8am, Almuerzo 1pm, Once 8pm ->
// colación entre Almuerzo y Once, que es el hueco medio de una estructura de 3 principales).
function elegirHuecosColaciones(huecos: number, cantidad: number): number[] {
    if (huecos <= 0 || cantidad <= 0) return new Array(Math.max(0, cantidad)).fill(0);
    if (cantidad === 1) return [Math.floor(huecos / 2)];
    // 2 o más colaciones: se reparten en huecos sucesivos empezando por el primero (regla
    // explícita para 5 tiempos: "una colación entre el 1er y 2do tiempo principal, y otra entre
    // el 2do y 3er tiempo principal").
    return Array.from({ length: cantidad }, (_, i) => i % huecos);
}

// Devuelve la lista final de tiempos de comida (mismo shape que el r24h de entrada) que tendrá el
// plan: los tiempos reportados por el paciente se preservan tal cual (mismos alimentos reportados),
// y los tiempos que se deban agregar para completar la estructura se insertan como entradas vacías.
export function determinarTiemposDeComida(r24h: Comida[] | null, objetivo: string): Comida[] {
    const filas = (r24h ?? [])
        .map((c) => ({ tipo: normalizarTiempo(c.tiempo_de_comida), original: c }))
        .filter((f): f is { tipo: TipoTiempo; original: Comida } => f.tipo !== null);

    let principales = ORDEN_PRINCIPALES.filter((p) => filas.some((f) => f.tipo === p));
    const colacionesReportadas = filas.filter((f) => f.tipo === 'colacion').map((f) => f.original);
    const totalInicial = principales.length + colacionesReportadas.length;

    const objetivoRequiereVolumen = objetivo === 'volumen';
    const targetTotal = objetivoRequiereVolumen ? 5 : 4;

    let cantidadColaciones = colacionesReportadas.length;

    if (totalInicial <= 3) {
        // 1, 2 o 3 tiempos: se completa a 3 principales + 1 (definir/mantener) o 2 (volumen) colaciones.
        for (const p of ORDEN_PRINCIPALES) {
            if (principales.length >= 3) break;
            if (!principales.includes(p)) principales = [...principales, p];
        }
        principales = ORDEN_PRINCIPALES.filter((p) => principales.includes(p));
        cantidadColaciones = Math.max(cantidadColaciones, targetTotal - 3);
    } else if (totalInicial === 4 && objetivoRequiereVolumen) {
        // 4 tiempos: solo se agrega un 5to tiempo (colación) si el objetivo es volumen.
        cantidadColaciones = cantidadColaciones + 1;
    }
    // 4 tiempos sin objetivo volumen, o 5+ tiempos: se usan tal cual, solo se ordenan
    // canónicamente los principales y se posicionan las colaciones con el default.

    const huecos = principales.length - 1;
    const huecosColaciones = elegirHuecosColaciones(huecos, cantidadColaciones);

    const resultado: Comida[] = [];
    let colacionPtr = 0;
    principales.forEach((tipo, i) => {
        const original = filas.find((f) => f.tipo === tipo)?.original;
        resultado.push(original ? { ...original, tiempo_de_comida: ETIQUETA_TIEMPO[tipo] } : comidaVacia(tipo));

        const colacionesEnEsteHueco = huecosColaciones.filter((h) => h === i).length;
        for (let c = 0; c < colacionesEnEsteHueco; c++) {
            const originalColacion = colacionesReportadas[colacionPtr];
            colacionPtr++;
            resultado.push(
                originalColacion
                    ? { ...originalColacion, tiempo_de_comida: ETIQUETA_TIEMPO.colacion }
                    : comidaVacia('colacion'),
            );
        }
    });
    return resultado;
}
