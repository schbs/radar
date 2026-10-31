// score: puntaje de oportunidad (0–100) para una agencia web, explicable. Cada señal suma puntos fijos (la web lenta,
// más cuanto peor es el rendimiento) y un negocio con muchas reseñas suma por estar activo. Mismo lead → mismo score.
import type { ComponenteScore, Enricher, Lead, Score } from "@/pipeline/tipos";
import { UMBRAL } from "./senales";

export const PESOS = {
  sin_web: 45,
  solo_redes: 40,
  web_no_responde: 40,
  sin_https: 20,
  sin_redireccion_https: 5,
  web_lenta_base: 15,
  web_lenta_tope: 35,
  lcp_lento: 10,
  sin_whatsapp: 10,
  pocas_resenas: 5,
  negocio_activo: 10,
} as const;

/** Desde cuántas reseñas un negocio cuenta como activo (vale la pena el contacto). */
export const RESENAS_ACTIVO = 20;

export function calcularScore(lead: Lead): Score {
  const componentes: ComponenteScore[] = [];
  for (const s of lead.senales ?? []) {
    let puntos: number;
    if (s.clave === "web_lenta") {
      const rendimiento = lead.pagespeed?.rendimiento ?? UMBRAL.rendimientoLento;
      puntos = Math.min(PESOS.web_lenta_tope, PESOS.web_lenta_base + Math.round((UMBRAL.rendimientoLento - rendimiento) * 0.4));
    } else {
      puntos = PESOS[s.clave];
    }
    componentes.push({ clave: s.clave, puntos, detalle: s.detalle });
  }
  if (lead.resenas != null && lead.resenas >= RESENAS_ACTIVO) {
    componentes.push({ clave: "negocio_activo", puntos: PESOS.negocio_activo, detalle: `Negocio activo: ${lead.resenas} reseñas en Google` });
  }
  // Orden estable: por puntos y, a igualdad, por clave (el resultado no depende del orden de las señales).
  componentes.sort((a, b) => b.puntos - a.puntos || a.clave.localeCompare(b.clave));
  const total = Math.min(100, componentes.reduce((s, c) => s + c.puntos, 0));
  const principal = componentes.find((c) => c.clave !== "negocio_activo");
  return { total, componentes, motivoPrincipal: principal?.detalle ?? "Sin señales de mejora en la web" };
}

export const score: Enricher = {
  name: "score",
  cost: 0,
  async run(lead) {
    return { score: calcularScore(lead) };
  },
};
