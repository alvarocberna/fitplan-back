import { plainToInstance } from 'class-transformer';
import {
  AnamnesisDtoImpl,
  ObjetivosDtoImpl,
  AnamnesisClinicaDtoImpl,
  AnamnesisAlimentariaDtoImpl,
  ComidaDtoImpl,
  GrupoPreferenciasAlimentariasDtoImpl,
  EstrategiaDeportivaDtoImpl,
  EstiloVidaSaludableDtoImpl,
  SesionDeportivaDtoImpl,
} from './consulta-completa.dto';

// Repara variaciones de forma que el LLM suele producir (campos anidados en vez de planos,
// arrays donde se esperaba texto, etc.) antes de que corran whitelist/class-validator, para
// que un desvío del modelo respecto al esquema no tumbe la request con un 400.

const COMIDA_KEYS = [
  'tiempo_de_comida',
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
] as const;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function toStringOrNull(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value === 'string') return value || null;
  if (Array.isArray(value)) {
    const joined = value.map(toStringOrNull).filter((v): v is string => !!v).join(', ');
    return joined || null;
  }
  if (isPlainObject(value)) {
    // valor anidado inesperado: intenta rescatar el primer valor útil en vez de fallar
    return toStringOrNull(Object.values(value)[0]);
  }
  return String(value);
}

function toStringArrayOrNull(value: unknown): string[] | null {
  if (value == null) return null;
  const arr = Array.isArray(value) ? value : [value];
  const result = arr.map(toStringOrNull).filter((v): v is string => !!v);
  return result.length ? result : null;
}

function toNumberOrNull(value: unknown): number | null {
  if (value == null) return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

// Repara el caso donde el modelo anida los campos de una comida bajo el nombre de esa
// comida, ej. { desayuno: { tiempo_de_comida: ..., carbohidrato: ... } } en vez del
// objeto plano { tiempo_de_comida: "desayuno", carbohidrato: ... } que espera ComidaDtoImpl.
function normalizeComida(raw: unknown): ComidaDtoImpl {
  const empty = Object.fromEntries(COMIDA_KEYS.map((key) => [key, null]));
  if (!isPlainObject(raw)) return plainToInstance(ComidaDtoImpl, empty);

  let source: Record<string, unknown> = raw;
  let inferredTiempo: string | null = null;

  const wrapperKey = Object.keys(raw).find(
    (key) => !(COMIDA_KEYS as readonly string[]).includes(key) && isPlainObject(raw[key]),
  );
  if (wrapperKey) {
    inferredTiempo = wrapperKey;
    source = raw[wrapperKey] as Record<string, unknown>;
  }

  const result: Record<string, string | null> = {};
  for (const key of COMIDA_KEYS) {
    result[key] = toStringOrNull(source[key]);
  }
  if (!result.tiempo_de_comida) result.tiempo_de_comida = inferredTiempo;

  return plainToInstance(ComidaDtoImpl, result);
}

function normalizeR24h(raw: unknown): ComidaDtoImpl[] | null {
  if (!Array.isArray(raw) || raw.length === 0) return null;
  return raw.map(normalizeComida);
}

function normalizeObjetivos(raw: unknown): ObjetivosDtoImpl | null {
  if (!isPlainObject(raw)) return null;
  return plainToInstance(ObjetivosDtoImpl, {
    objetivo_principal: toStringOrNull(raw.objetivo_principal),
    objetivo_secundario: toStringArrayOrNull(raw.objetivo_secundario),
  });
}

function normalizeClinica(raw: unknown): AnamnesisClinicaDtoImpl | null {
  if (!isPlainObject(raw)) return null;
  return plainToInstance(AnamnesisClinicaDtoImpl, {
    patologia: toStringOrNull(raw.patologia),
    antecedentes_morbidos_familiares: toStringOrNull(raw.antecedentes_morbidos_familiares),
    alergias: toStringOrNull(raw.alergias),
    intolerancias: toStringOrNull(raw.intolerancias),
    farmacos: toStringOrNull(raw.farmacos),
    antecedentes_gastrointestinales: toStringOrNull(raw.antecedentes_gastrointestinales),
    deposiciones: toStringOrNull(raw.deposiciones),
    cirugias: toStringOrNull(raw.cirugias),
  });
}

function normalizeGrupoPreferenciaAlimentaria(raw: unknown): GrupoPreferenciasAlimentariasDtoImpl | null {
  if (!isPlainObject(raw)) return null;
  return plainToInstance(GrupoPreferenciasAlimentariasDtoImpl, {
    grupo: toStringOrNull(raw.grupo) ?? '',
    consumoFrecuente: toStringArrayOrNull(raw.consumoFrecuente) ?? [],
    consumoOcasional: toStringArrayOrNull(raw.consumoOcasional) ?? [],
    consumoRaro: toStringArrayOrNull(raw.consumoRaro) ?? [],
    alimentosEvitados: toStringArrayOrNull(raw.alimentosEvitados) ?? [],
  });
}

function normalizeGrupoPreferenciasAlimentarias(raw: unknown): GrupoPreferenciasAlimentariasDtoImpl[] | null {
  if (!Array.isArray(raw) || raw.length === 0) return null;
  const result = raw
    .map(normalizeGrupoPreferenciaAlimentaria)
    .filter((g): g is GrupoPreferenciasAlimentariasDtoImpl => g !== null);
  return result.length ? result : null;
}

function normalizeEstrategiaDeportiva(raw: unknown): EstrategiaDeportivaDtoImpl | null {
  if (!isPlainObject(raw)) return null;
  return plainToInstance(EstrategiaDeportivaDtoImpl, {
    suplemento: toStringArrayOrNull(raw.suplemento),
    hidratacion: toStringArrayOrNull(raw.hidratacion),
    comida_pre_actividad: toStringOrNull(raw.comida_pre_actividad),
    comida_durante_actividad: toStringOrNull(raw.comida_durante_actividad),
    comida_post_actividad: toStringOrNull(raw.comida_post_actividad),
  });
}

function normalizeAlimentaria(raw: unknown): AnamnesisAlimentariaDtoImpl | null {
  if (!isPlainObject(raw)) return null;
  return plainToInstance(AnamnesisAlimentariaDtoImpl, {
    r24h: normalizeR24h(raw.r24h),
    grupo_preferencias_alimentarias: normalizeGrupoPreferenciasAlimentarias(raw.grupo_preferencias_alimentarias),
    estrategia_deportiva: normalizeEstrategiaDeportiva(raw.estrategia_deportiva),
  });
}

// Repara el caso donde el modelo anida los campos de una sesión deportiva bajo un
// nombre envolvente, análogo a normalizeComida.
function normalizeSesionDeportiva(raw: unknown): SesionDeportivaDtoImpl | null {
  if (!isPlainObject(raw)) return null;
  return plainToInstance(SesionDeportivaDtoImpl, {
    descripcion: toStringOrNull(raw.descripcion),
    disciplina: toStringOrNull(raw.disciplina),
    duracion: toNumberOrNull(raw.duracion),
    intensidad: toStringOrNull(raw.intensidad),
    tipo_evento: toStringOrNull(raw.tipo_evento),
    dias: toStringOrNull(raw.dias),
    horario: toStringOrNull(raw.horario),
  });
}

function normalizeSesionesDeportivas(raw: unknown): SesionDeportivaDtoImpl[] | null {
  if (!Array.isArray(raw) || raw.length === 0) return null;
  const result = raw
    .map(normalizeSesionDeportiva)
    .filter((s): s is SesionDeportivaDtoImpl => s !== null);
  return result.length ? result : null;
}

function normalizeEstiloVida(raw: unknown): EstiloVidaSaludableDtoImpl | null {
  if (!isPlainObject(raw)) return null;
  return plainToInstance(EstiloVidaSaludableDtoImpl, {
    alcohol: toStringOrNull(raw.alcohol),
    tabaco: toStringOrNull(raw.tabaco),
    nivel_actividad_fisica: toStringOrNull(raw.nivel_actividad_fisica),
    deporte: toStringArrayOrNull(raw.deporte),
    sesion_deportiva: normalizeSesionesDeportivas(raw.sesion_deportiva),
  });
}

// Punto de entrada: reconstruye el objeto anamnesis quedándose solo con las claves
// conocidas del esquema (protege contra "property X should not exist") y corrigiendo
// tipos comunes que el LLM suele desviar (texto envuelto en objeto/array, etc.).
export function normalizeAnamnesisPayload(raw: unknown): AnamnesisDtoImpl | null {
  if (!isPlainObject(raw)) return null;

  return plainToInstance(AnamnesisDtoImpl, {
    objetivos: normalizeObjetivos(raw.objetivos),
    clinica: normalizeClinica(raw.clinica),
    alimentaria: normalizeAlimentaria(raw.alimentaria),
    estilo_vida: normalizeEstiloVida(raw.estilo_vida),
  });
}
