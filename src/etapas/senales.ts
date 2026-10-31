// signals: convierte lo medido en señales de oportunidad para una agencia web. Cada señal lleva el dato que la
// sostiene, así el borrador (P5-G2) solo cita métricas reales.
import type { Enricher, Lead, Senal } from "@/pipeline/tipos";

/** Webs que en realidad son una red social o un agregador de enlaces: no se miden (bloquean pedidos automáticos). */
export const REDES = /(^|\.)(facebook\.com|fb\.com|instagram\.com|linktr\.ee|tiktok\.com|wa\.me|whatsapp\.com|x\.com|twitter\.com)$/i;

export function redSocialDe(web: string | null | undefined): string | null {
  if (!web) return null;
  try {
    const host = new URL(web).hostname.replace(/^www\./, "");
    if (!REDES.test(host)) return null;
    return /(^|\.)instagram\.com$/.test(host) ? "Instagram" : /(^|\.)(facebook|fb)\.com$/.test(host) ? "Facebook" : host;
  } catch {
    return null;
  }
}

export const UMBRAL = { rendimientoLento: 50, lcpLentoSegundos: 4, pocasResenas: 10 } as const;

const decimal = (n: number) => n.toFixed(1).replace(".", ",");

export function detectarSenales(lead: Lead): Senal[] {
  const s: Senal[] = [];
  const red = redSocialDe(lead.web);
  if (!lead.web) {
    s.push({ clave: "sin_web", detalle: "No tiene web en su ficha de Google" });
  } else if (red) {
    s.push({ clave: "solo_redes", detalle: `Su web en Google es una página de ${red}, no un sitio propio` });
  } else if (lead.sitio && !lead.sitio.alcanzable) {
    s.push({ clave: "web_no_responde", detalle: `La web no respondió (${lead.sitio.status ? `HTTP ${lead.sitio.status}` : (lead.sitio.error ?? "sin respuesta")})` });
  } else if (lead.sitio) {
    if (!lead.sitio.https) s.push({ clave: "sin_https", detalle: "La web no usa HTTPS" });
    else if (lead.sitio.redirigeAHttps === false) s.push({ clave: "sin_redireccion_https", detalle: "La versión http:// no redirige a https://" });
    if (!lead.sitio.whatsapp) s.push({ clave: "sin_whatsapp", detalle: "La portada no tiene botón de WhatsApp" });
  }
  const ps = lead.pagespeed;
  if (ps?.rendimiento != null && ps.rendimiento < UMBRAL.rendimientoLento) s.push({ clave: "web_lenta", detalle: `Rendimiento móvil de ${ps.rendimiento}/100 en PageSpeed` });
  if (ps?.lcpSegundos != null && ps.lcpSegundos > UMBRAL.lcpLentoSegundos) s.push({ clave: "lcp_lento", detalle: `La parte principal tarda ${decimal(ps.lcpSegundos)} s en aparecer en el celular (LCP; bueno: hasta 2,5 s)` });
  if (lead.resenas != null && lead.resenas < UMBRAL.pocasResenas) s.push({ clave: "pocas_resenas", detalle: `${lead.resenas} reseñas en Google` });
  return s;
}

export const signals: Enricher = {
  name: "signals",
  cost: 0,
  async run(lead) {
    return { senales: detectarSenales(lead) };
  },
};
