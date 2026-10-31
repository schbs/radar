import { describe, expect, it } from "vitest";
import fixture from "../fixtures/veterinarias-neuquen.json";
import { generarBorrador, MARCA_REVISION, MARCA_REVISION_EN, numerosPermitidos, revisarBorrador } from "@/borrador/borrador";
import { crearModeloPlantilla, modeloPlantilla } from "@/borrador/plantilla";
import { conSenalesEn } from "@/i18n/detalles";
import { crearCacheMemoria } from "@/cache/memoria";
import { celda, leadsACsv } from "@/exportar/csv";
import { crearExportHubspot, dominioDe } from "@/exportar/hubspot";
import type { ModeloJson } from "@/ia/gemini";
import { crearFetchFixtures, type FixtureRadar } from "@/pipeline/fetch-fixtures";
import { correrRadar } from "@/pipeline/radar";
import type { Lead } from "@/pipeline/tipos";

const fx = fixture as FixtureRadar;
const corrida = () => correrRadar(fx.consulta, { fetch: crearFetchFixtures(fx), cache: crearCacheMemoria(), ahora: () => 0, claves: {} }, { esperar: async () => undefined });

const lead: Lead = {
  placeId: "ficticio-vet-03",
  nombre: "Veterinaria Patitas del Limay",
  web: "http://patitas-del-limay.example/",
  traza: [],
  senales: [
    { clave: "web_lenta", detalle: "Rendimiento móvil de 38/100 en PageSpeed" },
    { clave: "lcp_lento", detalle: "La parte principal tarda 6,2 s en aparecer en el celular (LCP; bueno: hasta 2,5 s)" },
    { clave: "sin_https", detalle: "La web no usa HTTPS" },
  ],
};

const salida = (cambios: Record<string, unknown> = {}) => ({
  asunto: "Su web en el celular",
  lineas: ["Medimos su web: rendimiento móvil de 38/100 en PageSpeed.", "La parte principal tarda 6,2 s en aparecer.", "Podemos mostrarles qué cambiaríamos primero."],
  cta: "¿Les mostramos la medición en una charla corta?",
  metricas_citadas: ["web_lenta", "lcp_lento"],
  ...cambios,
});

describe("revisión del borrador", () => {
  it("acepta los números que salen de las señales", () => {
    expect([...numerosPermitidos(lead)]).toEqual(expect.arrayContaining(["38", "100", "6,2", "2,5"]));
    const r = revisarBorrador(lead, salida());
    expect(r.ok).toBe(true);
  });

  it("rechaza un número inventado", () => {
    const r = revisarBorrador(lead, salida({ lineas: ["Su web tarda 9 s en cargar.", "Pierden clientes.", "Lo arreglamos."] }));
    expect(r).toMatchObject({ ok: false, problemas: expect.arrayContaining([{ tipo: "numero_inventado", detalle: "9" }]) });
  });

  it("rechaza promesas de resultados y métricas que el negocio no tiene", () => {
    const r = revisarBorrador({ ...lead, senales: [...lead.senales!, { clave: "pocas_resenas", detalle: "15 reseñas" }] }, salida({ cta: "Garantizamos más clientes en 15 días", metricas_citadas: ["sin_web"] }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.problemas.map((p) => p.tipo).sort()).toEqual(["metrica_ajena", "promesa"]);
  });

  it("si el modelo inventa, se reintenta y, si sigue mal, no hay borrador", async () => {
    let llamadas = 0;
    const inventa: ModeloJson = { nombre: "falso", generar: async () => (llamadas++, { json: salida({ asunto: "Su web tarda 12 s" }), uso: { entrada: 10, salida: 5 } }) };
    const r = await generarBorrador(lead, inventa);
    expect(llamadas).toBe(2);
    expect(r).toMatchObject({ error: expect.stringContaining("revisión automática") });
  });

  it("sin señales no se escribe nada", async () => {
    expect(await generarBorrador({ ...lead, senales: [] }, modeloPlantilla)).toMatchObject({ error: expect.stringContaining("no tiene señales") });
  });

  it("la plantilla arma borradores válidos para todos los leads con señales, marcados y sin enviar", async () => {
    const { leads } = await corrida();
    for (const l of leads.filter((x) => x.senales?.length)) {
      const r = await generarBorrador(l, modeloPlantilla);
      expect("borrador" in r ? r.borrador : r).toMatchObject({ estado: MARCA_REVISION, enviado: false });
    }
  });

  it("en inglés: señales rearmadas con los mismos números, borrador válido y marcado en inglés", async () => {
    const { leads } = await corrida();
    const conSenales = leads.filter((x) => x.senales?.length);
    for (const l of conSenales) {
      const en = conSenalesEn(l, "en");
      // Los números de cada señal en inglés son los mismos que en español (la revisión los compara).
      for (const [i, s] of en.senales!.entries()) expect((s.detalle.match(/\d+(?:\.\d+)?/g) ?? []).map((n) => n.replace(".", ","))).toEqual(l.senales![i].detalle.match(/\d+(?:,\d+)?/g) ?? []);
      const r = await generarBorrador(en, crearModeloPlantilla("en"), 2, "en");
      expect("borrador" in r ? r.borrador : r).toMatchObject({ estado: MARCA_REVISION_EN, enviado: false });
    }
    expect(revisarBorrador(lead, salida({ cta: "We guarantee more customers" })).ok).toBe(false);
  });
});

describe("export", () => {
  it("CSV: encabezado, una fila por lead, BOM y celdas escapadas", async () => {
    const { leads } = await corrida();
    const csv = leadsACsv(leads);
    expect(csv.startsWith("﻿place_id,negocio,")).toBe(true);
    expect(csv.trim().split("\r\n")).toHaveLength(13);
    expect(celda('Dice "hola", y chau')).toBe('"Dice ""hola"", y chau"');
  });

  it("CSV: una celda que empieza con = no se ejecuta como fórmula", () => {
    expect(celda("=HYPERLINK(\"x\")")).toBe("\"'=HYPERLINK(\"\"x\"\")\"");
    expect(celda("-2+3")).toBe("'-2+3");
  });

  it("HubSpot: crea la empresa si no existe y la actualiza si ya está (por dominio)", async () => {
    const pedidos: { metodo: string; ruta: string; cuerpo: unknown }[] = [];
    let existe = false;
    const fetchFalso = async (url: string, init: RequestInit = {}) => {
      const ruta = new URL(url).pathname;
      pedidos.push({ metodo: init.method ?? "GET", ruta, cuerpo: init.body ? JSON.parse(String(init.body)) : null });
      if (ruta.endsWith("/search")) return Response.json({ results: existe ? [{ id: "77" }] : [] });
      if (init.method === "POST") return Response.json({ id: "77" });
      return Response.json({ id: "77" });
    };
    const hs = crearExportHubspot("token-falso", fetchFalso);
    const l = { ...lead, score: { total: 70, componentes: [], motivoPrincipal: "La web no usa HTTPS" } };
    expect(await hs.upsertEmpresa(l)).toEqual({ id: "77", creado: true });
    existe = true;
    expect(await hs.upsertEmpresa(l)).toEqual({ id: "77", creado: false });
    expect(pedidos.map((p) => `${p.metodo} ${p.ruta}`)).toEqual([
      "POST /crm/v3/objects/companies/search",
      "POST /crm/v3/objects/companies",
      "POST /crm/v3/objects/companies/search",
      "PATCH /crm/v3/objects/companies/77",
    ]);
    expect(pedidos[1].cuerpo).toMatchObject({ properties: { domain: "patitas-del-limay.example", description: "Radar: score 70 · La web no usa HTTPS" } });
    expect(dominioDe("https://www.ejemplo.example/x")).toBe("ejemplo.example");
    expect(dominioDe("https://www.facebook.com/vete.ejemplo")).toBeNull();
  });
});
