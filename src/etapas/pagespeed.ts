// pagespeed_mobile: PageSpeed Insights (Lighthouse móvil, solo la categoría de rendimiento). 429 y 5xx se reintentan
// (PageSpeed a veces responde 500 de forma pasajera).
import { DIA_MS, PRECIO } from "@/pipeline/precios";
import { ErrorHttp, type DatosPageSpeed, type Enricher } from "@/pipeline/tipos";
import { redSocialDe } from "./senales";

interface Lighthouse {
  categories?: { performance?: { score?: number | null } };
  audits?: Record<string, { numericValue?: number }>;
}

export function desdeLighthouse(lh: Lighthouse): DatosPageSpeed {
  const audit = (id: string) => lh.audits?.[id]?.numericValue ?? null;
  const puntaje = lh.categories?.performance?.score;
  const lcp = audit("largest-contentful-paint");
  return {
    rendimiento: puntaje == null ? null : Math.round(puntaje * 100),
    lcpSegundos: lcp == null ? null : Math.round(lcp / 100) / 10,
    cls: audit("cumulative-layout-shift"),
    tbtMs: audit("total-blocking-time"),
  };
}

export const pagespeedMobile: Enricher = {
  name: "pagespeed_mobile",
  cost: PRECIO.pagespeed,
  ttlMs: 7 * DIA_MS,
  saltear: (lead) => (!lead.web ? "sin web en Google" : redSocialDe(lead.web) ? "la web es una red social" : lead.sitio && !lead.sitio.alcanzable ? "la web no responde" : null),
  async run(lead, ctx) {
    const params = new URLSearchParams({ url: lead.web!, strategy: "mobile", category: "performance" });
    if (ctx.claves.google) params.set("key", ctx.claves.google);
    let r: Response;
    try {
      r = await ctx.fetch(`https://www.googleapis.com/pagespeedonline/v5/runPagespeed?${params}`, { signal: AbortSignal.timeout(120_000) });
    } catch (e) {
      throw new ErrorHttp(`PageSpeed sin respuesta: ${e instanceof Error ? e.name : "error"}`, null);
    }
    const cuerpo = (await r.json().catch(() => ({}))) as { lighthouseResult?: Lighthouse; error?: { message?: string } };
    if (!r.ok || !cuerpo.lighthouseResult) throw new ErrorHttp(`PageSpeed ${r.status}: ${cuerpo.error?.message ?? "sin resultado"}`, r.ok ? 500 : r.status);
    return { pagespeed: desdeLighthouse(cuerpo.lighthouseResult) };
  },
};
