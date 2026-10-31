// Arma la corrida completa: búsqueda por rubro y ciudad → cascada de etapas → leads ordenados por score.
import { pagespeedMobile } from "@/etapas/pagespeed";
import { buscarNegocios, placesSearch } from "@/etapas/places";
import { score } from "@/etapas/score";
import { signals } from "@/etapas/senales";
import { websiteCheck } from "@/etapas/sitio";
import { ejecutar, type OpcionesEjecucion, type Resumen } from "./ejecutar";
import type { Contexto, Enricher, Lead } from "./tipos";

export const ETAPAS: Enricher[] = [placesSearch, websiteCheck, pagespeedMobile, signals, score];

export async function correrRadar(consulta: { rubro: string; ciudad: string; maximo?: number }, ctx: Contexto, opciones?: OpcionesEjecucion): Promise<{ leads: Lead[]; resumen: Resumen & { busquedaDesdeCache: boolean } }> {
  const busqueda = await buscarNegocios(consulta, ctx);
  const { leads, resumen } = await ejecutar(busqueda.leads, ETAPAS, ctx, opciones);
  const ordenados = [...leads].sort((a, b) => (b.score?.total ?? 0) - (a.score?.total ?? 0) || (a.nombre ?? "").localeCompare(b.nombre ?? ""));
  return {
    leads: ordenados,
    resumen: { ...resumen, costoTotal: Math.round((resumen.costoTotal + busqueda.costo) * 10000) / 10000, busquedaDesdeCache: busqueda.desdeCache },
  };
}
