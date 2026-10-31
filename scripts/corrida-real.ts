// Corrida real chica (P5-G2): Places API (New) + webs + PageSpeed + borradores de Gemini para los mejores.
// No contacta a nadie: los borradores quedan marcados para revisión humana. Caché en data/cache/ y resultado en
// data/corridas/ (los dos fuera de git; se borran antes de publicar).
// Uso: npx tsx scripts/corrida-real.ts [rubro] [ciudad] [máximo ≤ 20] [borradores]
import fs from "node:fs";
import path from "node:path";
import { generarBorrador } from "../src/borrador/borrador";
import { crearCacheArchivo } from "../src/cache/memoria";
import { crearModeloGemini } from "../src/ia/gemini";
import { correrRadar } from "../src/pipeline/radar";

try {
  process.loadEnvFile(".env.local");
} catch {
  // sin archivo: falla abajo con un mensaje claro
}

async function main() {
  const [rubro = "veterinarias", ciudad = "Neuquén", maximoTexto = "15", borradoresTexto = "3"] = process.argv.slice(2);
  const maximo = Math.min(20, Number(maximoTexto));
  if (!process.env.GOOGLE_API_KEY) throw new Error("Falta GOOGLE_API_KEY (npm run check-env).");
  const t0 = Date.now();
  const { leads, resumen } = await correrRadar({ rubro, ciudad, maximo }, { fetch, cache: crearCacheArchivo(), ahora: Date.now, claves: { google: process.env.GOOGLE_API_KEY } }, { concurrencia: 3 });
  const minutos = (Date.now() - t0) / 60000;

  console.log(`Corrida real · "${rubro} en ${ciudad}" · ${leads.length} negocios · ${(Date.now() - t0) / 1000} s\n`);
  console.log("  #  score  negocio                                   web                         motivo principal");
  for (const [i, l] of leads.entries()) {
    console.log(`${String(i + 1).padStart(3)}  ${String(l.score?.total ?? "-").padStart(5)}  ${(l.nombre ?? "").slice(0, 40).padEnd(40)}  ${(l.web ? new URL(l.web).hostname : "sin web").slice(0, 26).padEnd(26)}  ${l.score?.motivoPrincipal ?? l.traza.find((p) => p.error)?.error ?? ""}`);
  }
  const conSenales = leads.filter((l) => l.senales?.length).length;
  console.log(
    `\n${resumen.ejecuciones} etapas ejecutadas, ${resumen.desdeCache} de caché, ${resumen.saltadas} salteadas, ${resumen.errores} errores · ${conSenales}/${leads.length} con señales · ${(leads.length / minutos).toFixed(1)} leads/min`,
  );
  console.log(`Costo de Google (lista, sin descontar el cupo gratis de 1.000 detalles por mes): USD ${resumen.costoTotal.toFixed(3)} · USD ${(resumen.costoTotal / Math.max(1, leads.length)).toFixed(4)} por lead`);

  const cuantos = Number(borradoresTexto);
  const borradores = [];
  if (cuantos > 0 && process.env.GEMINI_API_KEY) {
    const modelo = crearModeloGemini({ apiKey: process.env.GEMINI_API_KEY, modelo: process.env.GEMINI_MODEL || undefined });
    for (const l of leads.filter((x) => x.senales?.length).slice(0, cuantos)) {
      const r = await generarBorrador(l, modelo);
      borradores.push(r);
      if ("borrador" in r) {
        console.log(`\n— Borrador para ${r.borrador.negocio} (${r.borrador.estado})\nAsunto: ${r.borrador.asunto}\n${r.borrador.lineas.join("\n")}\n${r.borrador.cta}\nMétricas citadas: ${r.borrador.metricas_citadas.join(", ")} · tokens ${r.uso.entrada}/${r.uso.salida}`);
      } else {
        console.log(`\n— Sin borrador para ${l.nombre}: ${r.error} ${r.problemas.map((p) => `${p.tipo}: ${p.detalle}`).join("; ")}`);
      }
    }
  }
  const salida = path.join("data", "corridas", `${new Date().toISOString().slice(0, 19).replace(/:/g, "-")}.json`);
  fs.mkdirSync(path.dirname(salida), { recursive: true });
  fs.writeFileSync(salida, JSON.stringify({ consulta: { rubro, ciudad, maximo }, resumen, leadsPorMinuto: leads.length / minutos, leads, borradores }, null, 2));
  console.log(`\n→ ${salida} (fuera de git). No se contactó a ningún negocio.`);
}

void main().catch((e) => {
  console.error("Falló:", e instanceof Error ? e.message : e);
  process.exit(1);
});
