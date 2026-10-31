// fetch falso que responde como Places API (New), como cada web y como PageSpeed Insights a partir de un fixture.
// Lo usan los tests y la corrida en seco: nada sale a la red. Cuenta los pedidos por tipo para poder verificarlos.
import type { Fetch } from "./tipos";

export interface NegocioFixture {
  placeId: string;
  detalle: Record<string, unknown> & { websiteUri?: string };
  sitio?: { status?: number; final?: string; httpRedirige?: boolean; whatsapp?: boolean; error?: string };
  pagespeed?: { rendimiento: number; lcpMs: number; cls: number; tbtMs: number };
}

export interface FixtureRadar {
  descripcion: string;
  consulta: { rubro: string; ciudad: string };
  negocios: NegocioFixture[];
}

export type Pedidos = { busqueda: number; detalle: number; sitio: number; pagespeed: number };

const conUrl = (r: Response, url: string) => (Object.defineProperty(r, "url", { value: url }), r);
const json = (cuerpo: unknown, status = 200) => new Response(JSON.stringify(cuerpo), { status, headers: { "Content-Type": "application/json" } });

export function crearFetchFixtures(fx: FixtureRadar, ajustes: { pagespeed?: (url: string, intento: number) => Response | null } = {}): Fetch & { pedidos: Pedidos } {
  const pedidos: Pedidos = { busqueda: 0, detalle: 0, sitio: 0, pagespeed: 0 };
  const intentosPs = new Map<string, number>();
  const porWeb = (url: string) => fx.negocios.find((n) => n.detalle.websiteUri && new URL(n.detalle.websiteUri).host === new URL(url).host);

  const fetchFalso = async (entrada: string, init: RequestInit = {}): Promise<Response> => {
    const url = new URL(entrada);
    if (url.host === "places.googleapis.com") {
      if (url.pathname.endsWith("places:searchText")) {
        pedidos.busqueda++;
        const { pageSize } = JSON.parse(String(init.body ?? "{}")) as { pageSize?: number };
        return json({ places: fx.negocios.slice(0, pageSize ?? 20).map((n) => ({ id: n.placeId })) });
      }
      pedidos.detalle++;
      const id = decodeURIComponent(url.pathname.split("/").pop() ?? "");
      const n = fx.negocios.find((x) => x.placeId === id);
      return n ? json(n.detalle) : json({ error: { message: "Not found" } }, 404);
    }
    if (url.host === "www.googleapis.com" && url.pathname.includes("pagespeedonline")) {
      pedidos.pagespeed++;
      const objetivo = url.searchParams.get("url") ?? "";
      const intento = (intentosPs.get(objetivo) ?? 0) + 1;
      intentosPs.set(objetivo, intento);
      const forzada = ajustes.pagespeed?.(objetivo, intento);
      if (forzada) return forzada;
      const ps = porWeb(objetivo)?.pagespeed;
      if (!ps) return json({ error: { message: "Lighthouse returned error: FAILED_DOCUMENT_REQUEST" } }, 500);
      return json({
        lighthouseResult: {
          categories: { performance: { score: ps.rendimiento / 100 } },
          audits: { "largest-contentful-paint": { numericValue: ps.lcpMs }, "cumulative-layout-shift": { numericValue: ps.cls }, "total-blocking-time": { numericValue: ps.tbtMs } },
        },
      });
    }
    // Una web de la lista.
    pedidos.sitio++;
    const n = porWeb(entrada);
    const s = n?.sitio;
    if (!n || !s) throw new TypeError("fetch failed");
    if (s.error) throw Object.assign(new Error("The operation was aborted due to timeout"), { name: s.error });
    const final = s.final ?? n.detalle.websiteUri!;
    if (init.redirect === "manual" && url.protocol === "http:" && final.startsWith("https:")) {
      return s.httpRedirige ? new Response(null, { status: 301, headers: { Location: final } }) : conUrl(new Response("<html></html>", { status: 200 }), entrada);
    }
    const html = `<html><body><h1>${String((n.detalle.displayName as { text?: string })?.text ?? "")}</h1>${s.whatsapp ? '<a href="https://wa.me/message/EJEMPLO">WhatsApp</a>' : ""}</body></html>`;
    return conUrl(new Response(html, { status: s.status ?? 200 }), final);
  };
  return Object.assign(fetchFalso as Fetch, { pedidos });
}
