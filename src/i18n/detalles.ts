// Detalle de cada señal y de cada componente del score en el idioma de la consola. En español es el texto que arma el
// pipeline; en inglés se rearma por clave con los mismos datos medidos (los números no cambian: el borrador en inglés
// pasa la misma revisión de "solo números medidos").
import { redSocialDe } from "@/etapas/senales";
import type { ClaveSenal, ComponenteScore, Lead } from "@/pipeline/tipos";
import type { Idioma } from "./textos";

export function detalleEn(clave: ClaveSenal | "negocio_activo", lead: Lead): string {
  const ps = lead.pagespeed;
  switch (clave) {
    case "sin_web":
      return "No website on its Google listing";
    case "solo_redes":
      return `Its website on Google is a ${redSocialDe(lead.web) ?? "social media"} page, not its own site`;
    case "web_no_responde":
      return `The website did not respond (${lead.sitio?.status ? `HTTP ${lead.sitio.status}` : (lead.sitio?.error ?? "no response")})`;
    case "sin_https":
      return "The website does not use HTTPS";
    case "sin_redireccion_https":
      return "The http:// version does not redirect to https://";
    case "sin_whatsapp":
      return "No WhatsApp button on the home page";
    case "web_lenta":
      return `Mobile performance of ${ps?.rendimiento}/100 on PageSpeed`;
    case "lcp_lento":
      return `The main content takes ${ps?.lcpSegundos?.toFixed(1)} s to appear on mobile (LCP; good: up to 2.5 s)`;
    case "pocas_resenas":
      return `${lead.resenas} reviews on Google`;
    case "negocio_activo":
      return `Active business: ${lead.resenas} reviews on Google`;
  }
}

export const detalleDe = (c: Pick<ComponenteScore, "clave" | "detalle">, lead: Lead, idioma: Idioma) => (idioma === "en" ? detalleEn(c.clave, lead) : c.detalle);

export function motivoDe(lead: Lead, idioma: Idioma): string {
  if (idioma === "es") return lead.score?.motivoPrincipal ?? "";
  const principal = lead.score?.componentes.find((c) => c.clave !== "negocio_activo");
  return principal ? detalleEn(principal.clave, lead) : "No signs of improvement on the website";
}

const SALTOS_EN: Record<string, string> = {
  "sin web en Google": "no website on Google",
  "la web es una red social": "the website is a social media page",
  "la web no responde": "the website does not respond",
};

export const saltoDe = (motivo: string | undefined, idioma: Idioma) => (idioma === "en" ? (SALTOS_EN[motivo ?? ""] ?? motivo) : motivo);

/** El lead tal como lo necesita el borrador: con las señales en el idioma de la consola. */
export const conSenalesEn = (lead: Lead, idioma: Idioma): Lead => (idioma === "en" ? { ...lead, senales: lead.senales?.map((s) => ({ ...s, detalle: detalleEn(s.clave, lead) })) } : lead);
