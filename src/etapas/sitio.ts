// website_check: un pedido a la portada (siguiendo redirecciones) y, si la web es https, otro a la versión http para
// ver si redirige. Busca un enlace a WhatsApp en el HTML. Que la web no responda no es un error del pipeline: es una
// señal, así que no se reintenta.
import { DIA_MS, PRECIO } from "@/pipeline/precios";
import type { Contexto, DatosSitio, Enricher } from "@/pipeline/tipos";
import { redSocialDe } from "./senales";

const ENLACE_WHATSAPP = /(wa\.me\/|api\.whatsapp\.com\/send|web\.whatsapp\.com\/send|whatsapp:\/\/send)/i;
const MAX_HTML = 400_000;

async function redirigeAHttps(url: URL, ctx: Contexto): Promise<boolean | null> {
  const http = new URL(url.href);
  http.protocol = "http:";
  try {
    const r = await ctx.fetch(http.href, { method: "GET", redirect: "manual", signal: AbortSignal.timeout(8_000) });
    const destino = r.headers.get("location");
    if (r.status >= 300 && r.status < 400 && destino) return new URL(destino, http).protocol === "https:";
    return false;
  } catch {
    return null;
  }
}

export async function revisarSitio(web: string, ctx: Contexto): Promise<DatosSitio> {
  let r: Response;
  try {
    r = await ctx.fetch(web, { method: "GET", redirect: "follow", headers: { "User-Agent": "RadarDemo/0.1 (proyecto de demostración)" }, signal: AbortSignal.timeout(10_000) });
  } catch (e) {
    return { alcanzable: false, https: false, redirigeAHttps: null, status: null, whatsapp: false, error: e instanceof Error ? e.name : "error" };
  }
  const final = new URL(r.url || web);
  const https = final.protocol === "https:";
  if (!r.ok) return { alcanzable: false, https, redirigeAHttps: null, status: r.status, whatsapp: false, error: `HTTP ${r.status}` };
  const html = (await r.text().catch(() => "")).slice(0, MAX_HTML);
  return {
    alcanzable: true,
    https,
    // Si llegó a https desde una URL http, ya redirige; si arrancó en https, se prueba la versión http.
    redirigeAHttps: !https ? false : web.startsWith("http:") ? true : await redirigeAHttps(final, ctx),
    status: r.status,
    whatsapp: ENLACE_WHATSAPP.test(html),
  };
}

export const websiteCheck: Enricher = {
  name: "website_check",
  cost: PRECIO.sitio,
  ttlMs: 7 * DIA_MS,
  saltear: (lead) => (!lead.web ? "sin web en Google" : redSocialDe(lead.web) ? "la web es una red social" : null),
  async run(lead, ctx) {
    return { sitio: await revisarSitio(lead.web!, ctx) };
  },
};
