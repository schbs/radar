// Capturas del README y de los perfiles (1280×800), siempre en modo demo (negocios ficticios, sin datos de contacto):
// consola, ecos con la ficha, borrador para revisión, costo por etapa y filtro por score. En español van a
// docs/capturas/ y en inglés a docs/capturas/en/ (las de Upwork).
// Uso: npm run build && npm run capturas
import { execFileSync, spawn, type ChildProcess } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { chromium, type Page } from "@playwright/test";
import { TEXTOS, type Idioma } from "../src/i18n/textos";

const PUERTO = 3204;
const BASE = `http://localhost:${PUERTO}`;
const BRAVE = process.env.BRAVE_PATH ?? path.join(process.env.LOCALAPPDATA ?? "", "BraveSoftware/Brave-Browser/Application/brave.exe");
const NEGOCIO = "Veterinaria Patitas del Limay";

const arriba = async () => {
  try {
    return (await fetch(BASE)).ok;
  } catch {
    return false;
  }
};

async function capturar(page: Page, idioma: Idioma) {
  const t = TEXTOS[idioma];
  const dir = path.join("docs", "capturas", idioma === "en" ? "en" : "");
  fs.mkdirSync(dir, { recursive: true });
  const foto = (nombre: string) => page.screenshot({ path: path.join(dir, `${nombre}.png`) });
  const quieto = () => page.waitForTimeout(1600); // barrido y barras terminan

  await page.goto(`${BASE}${t.base || "/"}`);
  await quieto();
  await foto("1-consola");

  await page.getByRole("button", { name: NEGOCIO }).click();
  await page.locator("#titulo-ecos").scrollIntoViewIfNeeded();
  await page.evaluate(() => window.scrollTo(0, document.getElementById("titulo-ecos")!.getBoundingClientRect().top + window.scrollY - 16));
  await quieto();
  await foto("2-ecos-y-ficha");

  await page.getByRole("button", { name: t.ficha.armar }).click();
  await page.getByRole("status").filter({ hasText: idioma === "en" ? "Draft for human review" : "Borrador para revisión humana" }).waitFor();
  // El borrador entero a la vista (la ficha es sticky: se lo lleva al borde de abajo con un margen).
  await page.evaluate(() => {
    const borrador = document.getElementById("titulo-ficha")!.closest("section")!.querySelector("[role=status]")!;
    borrador.scrollIntoView({ block: "end" });
    window.scrollBy(0, 24);
  });
  await page.waitForTimeout(400);
  await foto("3-borrador");

  await page.goto(`${BASE}${t.base || "/"}`);
  await page.getByText(t.costo.detalle).click();
  await page.evaluate(() => window.scrollTo(0, document.querySelector("form")!.getBoundingClientRect().top + window.scrollY - 16));
  await quieto();
  await foto("4-costo-por-etapa");

  await page.getByText(t.filtros[2], { exact: true }).click();
  await page.getByText(t.costo.detalle).click();
  await page.evaluate(() => window.scrollTo(0, document.getElementById("titulo-ecos")!.getBoundingClientRect().top + window.scrollY - 16));
  await page.waitForTimeout(400);
  await foto("5-filtro-por-score");
  console.log(`  ${idioma}: 5 capturas en ${dir}`);
}

async function main() {
  let servidor: ChildProcess | null = null;
  if (!(await arriba())) {
    servidor = spawn(process.execPath, [path.join("node_modules", "next", "dist", "bin", "next"), "start", "-p", String(PUERTO)], { stdio: "ignore", env: { ...process.env, RADAR_REAL: "", RADAR_ESCUCHA: "" } });
    for (let i = 0; i < 60 && !(await arriba()); i++) await new Promise((r) => setTimeout(r, 1000));
  }
  const navegador = await chromium.launch({ executablePath: BRAVE });
  try {
    for (const idioma of ["es", "en"] as const) {
      const page = await navegador.newPage({ viewport: { width: 1280, height: 800 }, locale: idioma === "en" ? "en-US" : "es-AR" });
      await capturar(page, idioma);
      await page.close();
    }
  } finally {
    await navegador.close();
    if (servidor) {
      if (process.platform === "win32") execFileSync("taskkill", ["/pid", String(servidor.pid), "/T", "/F"], { stdio: "ignore" });
      else servidor.kill();
    }
  }
}

void main().catch((e) => {
  console.error("Falló:", e instanceof Error ? e.message : e);
  process.exit(1);
});
