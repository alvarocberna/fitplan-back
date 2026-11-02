// Cronómetro por fases para instrumentar un proceso largo (la generación del plan): mide cuánto dura
// cada paso y arma un resumen con el porcentaje de cada uno, para detectar cuellos de botella.
// Es una clase pura: no loguea nada, quien la usa decide qué hacer con las mediciones.

export interface PhaseEntry {
  phase: string;
  durationMs: number;
  // false si la fase terminó lanzando
  ok: boolean;
  // datos adjuntos a la fase: tokens, bytes, caracteres, modelo...
  data?: Record<string, unknown>;
}

export interface PhaseSummaryItem extends PhaseEntry {
  // porcentaje del total medido
  pct: number;
}

export interface PhaseSummary {
  // suma de las duraciones de todas las fases
  totalMs: number;
  phases: PhaseSummaryItem[];
  // nombre de la fase que más tiempo acumuló (null si no se midió nada)
  slowest: string | null;
}

const round = (value: number) => Math.round(value);

export class PhaseTimer {
  private readonly records: PhaseEntry[] = [];

  constructor(private readonly now: () => number = () => performance.now()) {}

  // Ejecuta `fn` (síncrona o asíncrona), registra su duración aunque lance, y devuelve su resultado.
  // `onDone` recibe la medición recién registrada (para loguearla en el momento).
  async measure<T>(
    phase: string,
    fn: () => T | Promise<T>,
    onDone?: (entry: PhaseEntry) => void,
  ): Promise<T> {
    const start = this.now();
    let ok = true;
    this.inProgress.add(phase);
    try {
      return await fn();
    } catch (error) {
      ok = false;
      throw error;
    } finally {
      this.inProgress.delete(phase);
      const entry = this.push(phase, this.now() - start, ok);
      onDone?.(entry);
    }
  }

  // Registra una duración que no corresponde a ejecutar una función (p. ej. el tiempo en cola).
  record(
    phase: string,
    durationMs: number,
    data?: Record<string, unknown>,
  ): PhaseEntry {
    const entry = this.push(phase, durationMs, true);
    if (data) entry.data = { ...data };
    return entry;
  }

  // Adjunta datos a una fase: si se está midiendo en este momento (el callback de métricas del modelo
  // llega mientras la llamada todavía corre), se guardan y se fusionan al registrarla; si ya terminó,
  // se agregan a su última medición.
  annotate(phase: string, data: Record<string, unknown>): void {
    if (this.inProgress.has(phase)) {
      this.pendingData.set(phase, { ...this.pendingData.get(phase), ...data });
      return;
    }
    const last = [...this.records]
      .reverse()
      .find((entry) => entry.phase === phase);
    if (last) last.data = { ...last.data, ...data };
  }

  entries(): PhaseEntry[] {
    return this.records.map((entry) => ({ ...entry }));
  }

  totalMs(): number {
    return round(
      this.records.reduce((sum, entry) => sum + entry.durationMs, 0),
    );
  }

  // Suma de las fases cuyo nombre cumple el predicado (p. ej. las llamadas al modelo).
  totalMsOf(matches: (phase: string) => boolean): number {
    return round(
      this.records
        .filter((entry) => matches(entry.phase))
        .reduce((sum, entry) => sum + entry.durationMs, 0),
    );
  }

  summary(): PhaseSummary {
    return summarizePhases(this.records);
  }

  private readonly inProgress = new Set<string>();
  private readonly pendingData = new Map<string, Record<string, unknown>>();

  private push(phase: string, durationMs: number, ok: boolean): PhaseEntry {
    const entry: PhaseEntry = {
      phase,
      durationMs: round(Math.max(0, durationMs)),
      ok,
    };
    const pending = this.pendingData.get(phase);
    if (pending) {
      entry.data = { ...pending };
      this.pendingData.delete(phase);
    }
    this.records.push(entry);
    return entry;
  }
}

// Resume una lista de mediciones (de uno o varios cronómetros): total, porcentaje de cada fase y la
// más lenta. Las fases repetidas (varios intentos) se muestran una por una, en orden.
export function summarizePhases(entries: PhaseEntry[]): PhaseSummary {
  const totalMs = round(
    entries.reduce((sum, entry) => sum + entry.durationMs, 0),
  );
  const byPhase = new Map<string, number>();
  for (const entry of entries) {
    byPhase.set(
      entry.phase,
      (byPhase.get(entry.phase) ?? 0) + entry.durationMs,
    );
  }
  let slowest: string | null = null;
  let slowestMs = -1;
  for (const [phase, durationMs] of byPhase) {
    if (durationMs > slowestMs) {
      slowest = phase;
      slowestMs = durationMs;
    }
  }
  return {
    totalMs,
    phases: entries.map((entry) => ({
      ...entry,
      pct:
        totalMs > 0 ? Math.round((entry.durationMs / totalMs) * 1000) / 10 : 0,
    })),
    slowest,
  };
}

// Acumula las mediciones por nombre de fase (suma de todos los intentos), de mayor a menor.
export function aggregatePhases(
  entries: PhaseEntry[],
): { phase: string; durationMs: number; pct: number; count: number }[] {
  const totalMs = entries.reduce((sum, entry) => sum + entry.durationMs, 0);
  const byPhase = new Map<string, { durationMs: number; count: number }>();
  for (const entry of entries) {
    const current = byPhase.get(entry.phase) ?? { durationMs: 0, count: 0 };
    byPhase.set(entry.phase, {
      durationMs: current.durationMs + entry.durationMs,
      count: current.count + 1,
    });
  }
  return [...byPhase.entries()]
    .map(([phase, { durationMs, count }]) => ({
      phase,
      durationMs: round(durationMs),
      pct: totalMs > 0 ? Math.round((durationMs / totalMs) * 1000) / 10 : 0,
      count,
    }))
    .sort((a, b) => b.durationMs - a.durationMs);
}
