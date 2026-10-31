// Corre el radar desde la web. Dos modos:
// - demo (por defecto, y siempre en un deploy público): los 12 negocios ficticios de tests/fixtures, sin red ni costo.
// - real (solo con `npm run dev:real`, que escucha en 127.0.0.1, y GOOGLE_API_KEY): Places, las webs y PageSpeed de
//   verdad, con la caché en data/cache/ (fuera de git). Lo enciende ese lanzador y no una variable del archivo de
//   claves: así un `next dev` o `next start` abierto a la red nunca queda en modo real.
import "server-only";
import fixture from "../../tests/fixtures/veterinarias-neuquen.json";
import { crearCacheArchivo, crearCacheMemoria } from "@/cache/memoria";
import { crearFetchFixtures, type FixtureRadar } from "@/pipeline/fetch-fixtures";
import { PRECIO } from "@/pipeline/precios";
import { correrRadar, ETAPAS } from "@/pipeline/radar";
import type { Lead } from "@/pipeline/tipos";

export type Modo = "demo" | "real";

export const modoRadar = (): Modo => (process.env.RADAR_REAL === "1" && process.env.RADAR_ESCUCHA === "127.0.0.1" && process.env.GOOGLE_API_KEY ? "real" : "demo");

export const CONSULTA_DEMO = (fixture as FixtureRadar).consulta;
/** Cómo se puede escribir el rubro del ejemplo (la consola en inglés propone "vets"). */
const RUBROS_DEMO = new Set([CONSULTA_DEMO.rubro, "veterinaria", "vets", "veterinarians", "veterinary clinics"]);

export interface LineaCosto {
  etapa: string;
  llamadas: number;
  precio: number;
  subtotal: number;
}

export interface Corrida {
  modo: Modo;
  consulta: { rubro: string; ciudad: string; maximo: number };
  leads: Lead[];
  costo: { lineas: LineaCosto[]; total: number; porLead: number };
  resumen: { leads: number; ejecuciones: number; desdeCache: number; saltadas: number; errores: number; ms: number; conSenales: number };
  /** Demo con una búsqueda distinta del ejemplo: la consola avisa que muestra el ejemplo. */
  avisoDemo: boolean;
}

const redondear = (n: number) => Math.round(n * 10000) / 10000;

/** Estado de costo: llamadas reales (sin caché ni salto) × precio de lista de cada etapa. */
export function costoDe(leads: Lead[], busquedaDesdeCache: boolean): Corrida["costo"] {
  const lineas: LineaCosto[] = [{ etapa: "text_search", llamadas: busquedaDesdeCache ? 0 : 1, precio: PRECIO.textSearchIds, subtotal: 0 }];
  for (const e of ETAPAS) {
    const llamadas = leads.filter((l) => l.traza.some((p) => p.etapa === e.name && !p.desdeCache && !p.saltada)).length;
    lineas.push({ etapa: e.name, llamadas, precio: e.cost, subtotal: 0 });
  }
  for (const l of lineas) l.subtotal = redondear(l.llamadas * l.precio);
  const total = redondear(lineas.reduce((t, l) => t + l.subtotal, 0));
  return { lineas, total, porLead: redondear(total / Math.max(1, leads.length)) };
}

export async function correr(consulta: { rubro: string; ciudad: string; maximo: number }): Promise<Corrida> {
  const modo = modoRadar();
  const t0 = Date.now();
  const r =
    modo === "real"
      ? await correrRadar(consulta, { fetch, cache: crearCacheArchivo(), ahora: Date.now, claves: { google: process.env.GOOGLE_API_KEY } }, { concurrencia: 3 })
      : await correrRadar({ ...CONSULTA_DEMO, maximo: consulta.maximo }, { fetch: crearFetchFixtures(fixture as FixtureRadar), cache: crearCacheMemoria(), ahora: Date.now, claves: {} }, { concurrencia: 4, esperar: async () => undefined });
  const igualADemo = RUBROS_DEMO.has(consulta.rubro.trim().toLowerCase()) && consulta.ciudad.trim().toLowerCase() === CONSULTA_DEMO.ciudad.toLowerCase();
  return {
    modo,
    // En la demo, la consulta que se muestra es la del ejemplo (con el rubro como lo escribió quien buscó, si coincide).
    consulta: modo === "real" || igualADemo ? consulta : { ...CONSULTA_DEMO, maximo: consulta.maximo },
    leads: r.leads,
    costo: costoDe(r.leads, r.resumen.busquedaDesdeCache),
    resumen: { leads: r.leads.length, ejecuciones: r.resumen.ejecuciones, desdeCache: r.resumen.desdeCache, saltadas: r.resumen.saltadas, errores: r.resumen.errores, ms: Date.now() - t0, conSenales: r.leads.filter((l) => l.senales?.length).length },
    avisoDemo: modo === "demo" && !igualADemo,
  };
}
