// Ejecuta las etapas en cascada sobre cada lead: concurrencia limitada entre leads, etapas en orden dentro de cada
// lead, reintentos con espera creciente solo para errores pasajeros (429, 5xx, red) y caché por etapa + place_id.
// Si una etapa falla del todo, el lead sigue: las etapas siguientes se saltean si les falta el dato.
import { ErrorHttp, type Contexto, type Enricher, type Lead, type PasoTraza } from "./tipos";

export interface OpcionesEjecucion {
  /** Leads procesados a la vez (las APIs de Google tienen cupo por minuto). */
  concurrencia?: number;
  /** Intentos totales por etapa ante errores pasajeros. */
  intentos?: number;
  /** Espera base entre intentos (se duplica en cada uno). */
  esperaBaseMs?: number;
  esperar?: (ms: number) => Promise<void>;
}

export interface Resumen {
  leads: number;
  costoTotal: number;
  /** Etapas que corrieron de verdad (sin caché ni salto). */
  ejecuciones: number;
  desdeCache: number;
  saltadas: number;
  errores: number;
  ms: number;
}

const esperarReal = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** Corre fn sobre cada elemento con, como máximo, `limite` a la vez. Mantiene el orden de los resultados. */
export async function enParalelo<T, R>(items: T[], limite: number, fn: (item: T, i: number) => Promise<R>): Promise<R[]> {
  const resultados = new Array<R>(items.length);
  let siguiente = 0;
  const trabajador = async () => {
    while (siguiente < items.length) {
      const i = siguiente++;
      resultados[i] = await fn(items[i], i);
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, Math.min(limite, items.length)) }, trabajador));
  return resultados;
}

async function correrEtapa(etapa: Enricher, lead: Lead, ctx: Contexto, op: Required<Omit<OpcionesEjecucion, "concurrencia">>): Promise<{ cambios: Partial<Lead>; paso: PasoTraza }> {
  const t0 = ctx.ahora();
  const paso: PasoTraza = { etapa: etapa.name, ms: 0, costo: 0, desdeCache: false, saltada: false, intentos: 0 };
  const motivo = etapa.saltear?.(lead) ?? null;
  if (motivo) return { cambios: {}, paso: { ...paso, saltada: true, motivo } };

  const clave = `${etapa.name}:${lead.placeId}`;
  if (etapa.ttlMs) {
    const guardado = await ctx.cache.leer<Partial<Lead>>(clave, ctx.ahora());
    if (guardado) return { cambios: guardado, paso: { ...paso, desdeCache: true } };
  }

  for (let intento = 1; ; intento++) {
    paso.intentos = intento;
    try {
      const cambios = await etapa.run(lead, ctx);
      if (etapa.ttlMs) await ctx.cache.guardar(clave, cambios, etapa.ttlMs, ctx.ahora());
      return { cambios, paso: { ...paso, costo: etapa.cost, ms: ctx.ahora() - t0 } };
    } catch (e) {
      const pasajero = e instanceof ErrorHttp ? e.reintentable : false;
      if (!pasajero || intento >= op.intentos) {
        // El error de una API externa no lleva la clave; se guarda solo el mensaje.
        return { cambios: {}, paso: { ...paso, costo: e instanceof ErrorHttp && e.status !== null ? etapa.cost : 0, ms: ctx.ahora() - t0, error: e instanceof Error ? e.message : String(e) } };
      }
      await op.esperar(op.esperaBaseMs * 2 ** (intento - 1));
    }
  }
}

export async function ejecutar(leads: Lead[], etapas: Enricher[], ctx: Contexto, opciones: OpcionesEjecucion = {}): Promise<{ leads: Lead[]; resumen: Resumen }> {
  const t0 = ctx.ahora();
  const op = { intentos: opciones.intentos ?? 3, esperaBaseMs: opciones.esperaBaseMs ?? 1000, esperar: opciones.esperar ?? esperarReal };
  const salida = await enParalelo(leads, opciones.concurrencia ?? 4, async (inicial) => {
    let lead: Lead = { ...inicial, traza: [...inicial.traza] };
    for (const etapa of etapas) {
      const { cambios, paso } = await correrEtapa(etapa, lead, ctx, op);
      lead = { ...lead, ...cambios, traza: [...lead.traza, paso] };
    }
    return lead;
  });
  const pasos = salida.flatMap((l) => l.traza);
  return {
    leads: salida,
    resumen: {
      leads: salida.length,
      costoTotal: Math.round(pasos.reduce((s, p) => s + p.costo, 0) * 10000) / 10000,
      ejecuciones: pasos.filter((p) => !p.desdeCache && !p.saltada && !p.error).length,
      desdeCache: pasos.filter((p) => p.desdeCache).length,
      saltadas: pasos.filter((p) => p.saltada).length,
      errores: pasos.filter((p) => p.error).length,
      ms: ctx.ahora() - t0,
    },
  };
}
