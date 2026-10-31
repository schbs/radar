import fs from "node:fs";
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

/** axe con reglas WCAG 2.1 AA: no tiene que haber violaciones serias ni críticas. */
async function revisarAccesibilidad(page: Page, nombre: string) {
  const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  const graves = r.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  console.log(`  axe → ${nombre}: ${r.passes.length} reglas OK, ${r.violations.length} violaciones (${graves.length} serias o críticas)`);
  expect(graves.map((v) => `${v.id}: ${v.help} (${v.nodes.length})`)).toEqual([]);
}

const filas = (page: Page) => page.getByRole("table", { name: /^Negocios ordenados/ }).locator("tbody tr");

test("la demo llega con la corrida de ejemplo ordenada por score y su costo", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1, name: "Radar de prospección" })).toBeVisible();
  await expect(page.getByText("Demo · negocios ficticios, sin pedidos reales")).toBeVisible();
  await expect(filas(page)).toHaveCount(12);
  const scores = (await filas(page).locator("td:first-child span.font-mono").allTextContents()).map(Number);
  expect(scores).toEqual([...scores].sort((a, b) => b - a));
  await expect(page.getByRole("heading", { name: "Costo de la corrida" })).toBeVisible();
  // 12 detalles de Places × USD 0,02 (la búsqueda de IDs no se cobra; las webs y PageSpeed tampoco).
  await expect(page.getByText("Total estimado").locator("xpath=following-sibling::dd")).toHaveText("USD 0,240");
  await revisarAccesibilidad(page, "inicio");
});

test("filtrar por score deja solo los que llegan", async ({ page }) => {
  await page.goto("/");
  await page.getByText("50 o más", { exact: true }).click();
  const scores = (await filas(page).locator("td:first-child span.font-mono").allTextContents()).map(Number);
  expect(scores.length).toBeGreaterThan(0);
  expect(scores.length).toBeLessThan(12);
  expect(scores.every((s) => s >= 50)).toBe(true);
  await expect(page.getByRole("heading", { name: new RegExp(`Ecos \\(${scores.length} de 12\\)`) })).toBeVisible();
});

test("la ficha explica el puntaje y el borrador queda para revisión humana, sin forma de enviarlo", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Veterinaria Barrio Oeste" }).click();
  const ficha = page.getByRole("heading", { level: 2, name: "Veterinaria Barrio Oeste" });
  await expect(ficha).toBeFocused();
  await expect(page.getByText("Por qué tiene este puntaje")).toBeVisible();
  await page.getByRole("button", { name: "Armar borrador" }).click();
  await expect(page.getByText("Borrador para revisión humana: no se envió a nadie.")).toBeVisible();
  await expect(page.getByText(/^Cita: /)).toBeVisible();
  await expect(page.getByRole("button", { name: /enviar/i })).toHaveCount(0);
  await revisarAccesibilidad(page, "ficha con borrador");
});

test("exportar: CSV con los negocios filtrados y HubSpot simulado", async ({ page }) => {
  await page.goto("/");
  await page.getByText("30 o más", { exact: true }).click();
  const cuantos = await filas(page).count();
  const [descarga] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: /^Exportar CSV/ }).click()]);
  const csv = fs.readFileSync((await descarga.path())!, "utf8").replace(/^﻿/, "").trim().split(/\r?\n/);
  expect(csv[0]).toBe("place_id,negocio,rubro,direccion,web,score,motivo_principal,senales,rendimiento_movil,lcp_s,resenas");
  expect(csv).toHaveLength(cuantos + 1);
  await page.getByRole("button", { name: "Pasar a HubSpot" }).click();
  await expect(page.getByText(new RegExp(`Simulación: se harían ${cuantos} upserts`))).toBeVisible();
});

test("una búsqueda distinta en la demo avisa que muestra el ejemplo", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Rubro").fill("panaderías");
  await page.getByLabel("Ciudad").fill("Cipolletti");
  await page.getByLabel("Máximo").selectOption("5");
  await page.getByRole("button", { name: "Barrer" }).click();
  await expect(page.getByText(/La demo pública solo tiene la búsqueda de ejemplo/)).toBeVisible();
  await expect(filas(page)).toHaveCount(5);
});

test("la API rechaza consultas inválidas", async ({ request }) => {
  const r = await request.post("/api/corrida", { data: { rubro: "x", ciudad: "Neuquén", maximo: 50 } });
  expect(r.status()).toBe(400);
  const b = await request.post("/api/borrador", { data: { nombre: "sin placeId" } });
  expect(b.status()).toBe(400);
  // Otro sitio no puede dispararlas desde el navegador de quien tiene la consola abierta.
  const ajeno = await request.post("/api/corrida", { data: { rubro: "veterinarias", ciudad: "Neuquén" }, headers: { Origin: "https://otro-sitio.example" } });
  expect(ajeno.status()).toBe(403);
  const sinJson = await request.post("/api/hubspot", { data: "rubro=x", headers: { "Content-Type": "application/x-www-form-urlencoded" } });
  expect(sinJson.status()).toBe(415);
});

test("en inglés: la consola, el porqué del puntaje y el borrador salen en inglés con los mismos números", async ({ page }) => {
  await page.goto("/en");
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page.getByRole("heading", { level: 1, name: "Prospecting radar" })).toBeVisible();
  await expect(page.getByText("Estimated total").locator("xpath=following-sibling::dd")).toHaveText("USD 0.240");
  await page.getByRole("button", { name: "Veterinaria Patitas del Limay" }).click();
  await expect(page.getByText("Mobile performance of 38/100 on PageSpeed")).toBeVisible();
  await page.getByRole("button", { name: "Write draft" }).click();
  await expect(page.getByText("Draft for human review: not sent to anyone.")).toBeVisible();
  await expect(page.getByText(/One concrete improvement|one concrete improvement/)).toBeVisible();
  await expect(page.getByText(/[áéíóúñ]/).filter({ hasText: /We |Also/ })).toHaveCount(0);
  await revisarAccesibilidad(page, "/en con borrador");
  await page.getByRole("link", { name: "Español" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Radar de prospección" })).toBeVisible();
});
