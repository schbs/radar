import { describe, expect, it } from "vitest";
import fixture from "../fixtures/veterinarias-neuquen.json";
import { crearCacheMemoria } from "@/cache/memoria";
import { TTL_MAXIMO_MS, TtlInvalido } from "@/cache/tipos";
import { pagespeedMobile } from "@/etapas/pagespeed";
import { buscarNegocios, placesSearch } from "@/etapas/places";
import { calcularScore } from "@/etapas/score";
import { detectarSenales, redSocialDe } from "@/etapas/senales";
import { revisarSitio, websiteCheck } from "@/etapas/sitio";
import { ejecutar, enParalelo } from "@/pipeline/ejecutar";
import { crearFetchFixtures, type FixtureRadar } from "@/pipeline/fetch-fixtures";
import { DIA_MS, PRECIO } from "@/pipeline/precios";
import { correrRadar, ETAPAS } from "@/pipeline/radar";
import type { Contexto, Lead } from "@/pipeline/tipos";

const fx = fixture as FixtureRadar;
const AHORA = Date.UTC(2026, 10, 1);
const sinEspera = async () => undefined;

function contexto(fetch = crearFetchFixtures(fx), cache = crearCacheMemoria(), ahora = () => AHORA): Contexto & { fetch: ReturnType<typeof crearFetchFixtures> } {
  return { fetch, cache, ahora, claves: { google: "clave-falsa" } };
}

const lead = (parcial: Partial<Lead>): Lead => ({ placeId: "x", traza: [], ...parcial });

describe("señales", () => {
  it("sin web: solo 'sin_web' (y las reseñas si son pocas)", () => {
    expect(detectarSenales(lead({ web: null, resenas: 6 })).map((s) => s.clave)).toEqual(["sin_web", "pocas_resenas"]);
  });

  it("web sin https, lenta y sin WhatsApp, con el dato medido en cada detalle", () => {
    const s = detectarSenales(lead({ web: "http://a.example/", resenas: 35, sitio: { alcanzable: true, https: false, redirigeAHttps: false, status: 200, whatsapp: false }, pagespeed: { rendimiento: 38, lcpSegundos: 6.2, cls: 0.3, tbtMs: 880 } }));
    expect(s.map((x) => x.clave)).toEqual(["sin_https", "sin_whatsapp", "web_lenta", "lcp_lento"]);
    expect(s.find((x) => x.clave === "web_lenta")?.detalle).toContain("38/100");
    expect(s.find((x) => x.clave === "lcp_lento")?.detalle).toContain("6,2 s");
  });

  it("web que no responde: no se miran https ni WhatsApp", () => {
    expect(detectarSenales(lead({ web: "https://a.example/", sitio: { alcanzable: false, https: true, redirigeAHttps: null, status: 503, whatsapp: false } })).map((s) => s.clave)).toEqual(["web_no_responde"]);
  });

  it("si la web de Google es Facebook o Instagram: 'solo_redes', no 'web_no_responde'", () => {
    expect(detectarSenales(lead({ web: "https://www.facebook.com/vete.ejemplo", sitio: { alcanzable: false, https: true, redirigeAHttps: null, status: 400, whatsapp: false } })).map((s) => s.clave)).toEqual(["solo_redes"]);
    expect(detectarSenales(lead({ web: "https://instagram.com/vete.ejemplo" }))[0].detalle).toContain("Instagram");
    expect(redSocialDe("https://facebookmascotas.example/")).toBeNull();
    expect(redSocialDe("https://m.facebook.com/x")).toBe("Facebook");
  });

  it("una web buena no da señales", () => {
    expect(detectarSenales(lead({ web: "https://a.example/", resenas: 210, sitio: { alcanzable: true, https: true, redirigeAHttps: true, status: 200, whatsapp: true }, pagespeed: { rendimiento: 92, lcpSegundos: 1.9, cls: 0, tbtMs: 90 } }))).toEqual([]);
  });
});

describe("score explicable", () => {
  const base = lead({ web: "http://a.example/", resenas: 35, pagespeed: { rendimiento: 38, lcpSegundos: 6.2, cls: 0.3, tbtMs: 880 } });
  const conSenales = { ...base, senales: detectarSenales({ ...base, sitio: { alcanzable: true, https: false, redirigeAHttps: false, status: 200, whatsapp: false } }) };

  it("es determinista y no depende del orden de las señales", () => {
    const a = calcularScore(conSenales);
    const b = calcularScore({ ...conSenales, senales: [...conSenales.senales!].reverse() });
    expect(a).toEqual(b);
    expect(a.total).toBe(70);
  });

  it("total = suma de componentes, ordenados de mayor a menor, con el motivo principal del de más peso", () => {
    const s = calcularScore(conSenales);
    expect(s.total).toBe(s.componentes.reduce((t, c) => t + c.puntos, 0));
    expect(s.componentes.map((c) => c.puntos)).toEqual([...s.componentes.map((c) => c.puntos)].sort((x, y) => y - x));
    expect(s.motivoPrincipal).toBe(s.componentes[0].detalle);
  });

  it("tope de 100 y, sin señales, el motivo lo dice", () => {
    const muchas = calcularScore(lead({ resenas: 300, pagespeed: { rendimiento: 0, lcpSegundos: 20, cls: 1, tbtMs: 5000 }, senales: [{ clave: "sin_web", detalle: "a" }, { clave: "web_no_responde", detalle: "b" }, { clave: "sin_https", detalle: "c" }] }));
    expect(muchas.total).toBe(100);
    const ninguna = calcularScore(lead({ resenas: 210, senales: [] }));
    expect(ninguna).toMatchObject({ total: 10, motivoPrincipal: "Sin señales de mejora en la web" });
  });
});

describe("cascada", () => {
  it("sin web se saltean website_check y pagespeed, sin costo ni pedidos", async () => {
    const ctx = contexto();
    const { leads } = await ejecutar([lead({ placeId: "ficticio-vet-01" })], ETAPAS, ctx, { esperar: sinEspera });
    const t = Object.fromEntries(leads[0].traza.map((p) => [p.etapa, p]));
    expect(t.website_check).toMatchObject({ saltada: true, costo: 0, motivo: "sin web en Google" });
    expect(t.pagespeed_mobile).toMatchObject({ saltada: true, costo: 0 });
    expect(ctx.fetch.pedidos).toMatchObject({ sitio: 0, pagespeed: 0 });
    expect(leads[0].score?.motivoPrincipal).toBe("No tiene web en su ficha de Google");
  });

  it("una red social como web no se mide: sin pedidos al sitio ni a PageSpeed", async () => {
    const ctx = contexto();
    const { leads } = await ejecutar([lead({ placeId: "x", web: "https://www.instagram.com/vete.ejemplo/" })], [websiteCheck, pagespeedMobile], ctx, { esperar: sinEspera });
    expect(leads[0].traza.every((p) => p.saltada && p.motivo === "la web es una red social")).toBe(true);
    expect(ctx.fetch.pedidos).toMatchObject({ sitio: 0, pagespeed: 0 });
  });

  it("si la web no responde, PageSpeed se saltea y queda la señal", async () => {
    const ctx = contexto();
    const { leads } = await ejecutar([lead({ placeId: "ficticio-vet-04" }), lead({ placeId: "ficticio-vet-09" })], ETAPAS, ctx, { esperar: sinEspera });
    for (const l of leads) {
      expect(l.traza.find((p) => p.etapa === "pagespeed_mobile")).toMatchObject({ saltada: true, motivo: "la web no responde" });
      expect(l.senales?.[0].clave).toBe("web_no_responde");
    }
    expect(leads[1].senales?.[0].detalle).toContain("TimeoutError");
  });

  it("website_check detecta https, la redirección desde http y el botón de WhatsApp", async () => {
    const ctx = contexto();
    expect(await revisarSitio("https://confluencia-sur.example/", ctx)).toMatchObject({ alcanzable: true, https: true, redirigeAHttps: true, whatsapp: true });
    expect(await revisarSitio("https://sanmartin-norte.example/", ctx)).toMatchObject({ https: true, redirigeAHttps: false });
    expect(await revisarSitio("http://patitas-del-limay.example/", ctx)).toMatchObject({ https: false, whatsapp: false });
  });
});

describe("caché y TTL", () => {
  it("la segunda corrida sale de la caché: sin pedidos a Google ni costo", async () => {
    const cache = crearCacheMemoria();
    const primera = await correrRadar(fx.consulta, contexto(crearFetchFixtures(fx), cache), { esperar: sinEspera });
    const fetch2 = crearFetchFixtures(fx);
    const segunda = await correrRadar(fx.consulta, contexto(fetch2, cache), { esperar: sinEspera });
    expect(primera.resumen.costoTotal).toBeGreaterThan(0);
    expect(segunda.resumen).toMatchObject({ costoTotal: 0, busquedaDesdeCache: true });
    expect(fetch2.pedidos).toEqual({ busqueda: 0, detalle: 0, sitio: 0, pagespeed: 0 });
    expect(segunda.leads.map((l) => l.score)).toEqual(primera.leads.map((l) => l.score));
  });

  it("lo vencido se vuelve a pedir, y nada se guarda por más de 30 días", async () => {
    const cache = crearCacheMemoria();
    await ejecutar([lead({ placeId: "ficticio-vet-02" })], [placesSearch], contexto(crearFetchFixtures(fx), cache));
    const despues = crearFetchFixtures(fx);
    await ejecutar([lead({ placeId: "ficticio-vet-02" })], [placesSearch], contexto(despues, cache, () => AHORA + 31 * DIA_MS));
    expect(despues.pedidos.detalle).toBe(1);
    expect(Object.values(cache.entradas).every((e) => e.venceEn - e.guardadoEn <= TTL_MAXIMO_MS)).toBe(true);
    await expect(cache.guardar("x", 1, 31 * DIA_MS, AHORA)).rejects.toBeInstanceOf(TtlInvalido);
  });

  it("de la búsqueda solo se guardan los place_id", async () => {
    const cache = crearCacheMemoria();
    const r = await buscarNegocios({ ...fx.consulta, maximo: 5 }, contexto(crearFetchFixtures(fx), cache));
    expect(r.costo).toBe(PRECIO.textSearchIds);
    expect(cache.entradas["busqueda:veterinarias en neuquén"].valor).toEqual(["ficticio-vet-01", "ficticio-vet-02", "ficticio-vet-03", "ficticio-vet-04", "ficticio-vet-05"]);
  });
});

describe("reintentos y concurrencia", () => {
  it("un 429 de PageSpeed se reintenta y sale bien al segundo intento", async () => {
    const esperas: number[] = [];
    const fetch = crearFetchFixtures(fx, { pagespeed: (_url, intento) => (intento === 1 ? new Response("{}", { status: 429 }) : null) });
    const { leads } = await ejecutar([lead({ placeId: "ficticio-vet-02", web: "https://confluencia-sur.example/" })], [pagespeedMobile], contexto(fetch), { esperaBaseMs: 1000, esperar: async (ms) => void esperas.push(ms) });
    expect(leads[0].traza[0]).toMatchObject({ intentos: 2 });
    expect(leads[0].pagespeed?.rendimiento).toBe(92);
    expect(esperas).toEqual([1000]);
  });

  it("un 400 no se reintenta: queda el error y el lead sigue", async () => {
    const fetch = crearFetchFixtures(fx, { pagespeed: () => new Response(JSON.stringify({ error: { message: "URL inválida" } }), { status: 400 }) });
    const { leads, resumen } = await ejecutar([lead({ placeId: "ficticio-vet-02", web: "https://confluencia-sur.example/" })], [pagespeedMobile], contexto(fetch), { esperar: sinEspera });
    expect(leads[0].traza[0]).toMatchObject({ intentos: 1, error: "PageSpeed 400: URL inválida" });
    expect(resumen.errores).toBe(1);
  });

  it("nunca corre más leads a la vez que el límite", async () => {
    let activos = 0;
    let maximo = 0;
    await enParalelo(Array.from({ length: 12 }, (_, i) => i), 3, async () => {
      maximo = Math.max(maximo, ++activos);
      await new Promise((r) => setTimeout(r, 5));
      activos--;
    });
    expect(maximo).toBe(3);
  });
});

describe("corrida completa con fixtures", () => {
  it("12 leads ordenados por score, cada uno con motivo y costo estimado", async () => {
    const { leads, resumen } = await correrRadar(fx.consulta, contexto(), { esperar: sinEspera });
    expect(leads).toHaveLength(12);
    expect(leads.map((l) => l.score!.total)).toEqual([...leads.map((l) => l.score!.total)].sort((a, b) => b - a));
    expect(leads[0]).toMatchObject({ nombre: "Veterinaria Patitas del Limay", score: { total: 70 } });
    expect(leads.every((l) => l.score!.motivoPrincipal.length > 0)).toBe(true);
    expect(resumen).toMatchObject({ leads: 12, errores: 0, costoTotal: Math.round((PRECIO.textSearchIds + 12 * PRECIO.detalleLugar) * 10000) / 10000 });
  });
});
