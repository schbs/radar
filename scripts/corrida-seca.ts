// Corrida en seco: el pipeline completo contra los fixtures ficticios (sin red, sin claves, sin costo real).
// Imprime los 10 leads con más oportunidad para "Pixel Patagonia" (agencia web ficticia), con score y motivos.
// Uso: npm run radar:seco
import fixture from "../tests/fixtures/veterinarias-neuquen.json";
import { crearCacheMemoria } from "../src/cache/memoria";
import { crearFetchFixtures, type FixtureRadar } from "../src/pipeline/fetch-fixtures";
import { correrRadar } from "../src/pipeline/radar";

async function main() {
  const fx = fixture as FixtureRadar;
  const fetch = crearFetchFixtures(fx);
  const { leads, resumen } = await correrRadar(fx.consulta, { fetch, cache: crearCacheMemoria(), ahora: Date.now, claves: {} }, { concurrencia: 4, esperar: async () => undefined });

  console.log(`Radar · Pixel Patagonia (agencia ficticia) · "${fx.consulta.rubro} en ${fx.consulta.ciudad}" · DATOS FICTICIOS, sin red\n`);
  for (const [i, l] of leads.slice(0, 10).entries()) {
    console.log(`${String(i + 1).padStart(2)}. ${String(l.score?.total ?? 0).padStart(3)}  ${l.nombre}  ·  ${l.web ?? "sin web"}`);
    console.log(`       motivo: ${l.score?.motivoPrincipal}`);
    const otros = (l.score?.componentes ?? []).slice(1).map((c) => `${c.detalle} (+${c.puntos})`);
    if (otros.length) console.log(`       además: ${otros.join(" · ")}`);
  }
  console.log(
    `\n${resumen.leads} leads · ${resumen.ejecuciones} etapas ejecutadas, ${resumen.saltadas} salteadas en cascada, ${resumen.errores} errores · costo estimado USD ${resumen.costoTotal.toFixed(3)} (USD ${(resumen.costoTotal / resumen.leads).toFixed(4)} por lead)`,
  );
  console.log(`Pedidos simulados: ${fetch.pedidos.busqueda} búsqueda, ${fetch.pedidos.detalle} detalles de Places, ${fetch.pedidos.sitio} a webs, ${fetch.pedidos.pagespeed} a PageSpeed. No se contactó a ningún negocio.`);
}

void main().catch((e) => {
  console.error("Falló:", e instanceof Error ? e.message : e);
  process.exit(1);
});
