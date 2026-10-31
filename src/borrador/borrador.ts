// Borrador de abordaje para un negocio: asunto, 3 líneas personalizadas que citan 1 o 2 métricas reales y un llamado
// suave. Lo escribe Gemini con salida JSON y se valida: solo puede usar números que salen de las señales medidas y no
// puede prometer resultados. NUNCA se envía: no hay ninguna función de envío y cada borrador queda marcado.
import { z } from "zod";
import type { ModeloJson, Uso } from "@/ia/gemini";
import type { ClaveSenal, Lead } from "@/pipeline/tipos";

export const MARCA_REVISION = "Borrador para revisión humana: no se envió a nadie.";
export const MARCA_REVISION_EN = "Draft for human review: not sent to anyone.";

export type IdiomaBorrador = "es" | "en";

export const CLAVES = ["sin_web", "solo_redes", "web_no_responde", "sin_https", "sin_redireccion_https", "web_lenta", "lcp_lento", "sin_whatsapp", "pocas_resenas"] as const;

/** Lo que se le pide al modelo. */
export const salidaBorradorSchema = z.object({
  asunto: z.string().min(5).max(80),
  lineas: z.array(z.string().min(10).max(240)).length(3),
  cta: z.string().min(5).max(160),
  metricas_citadas: z.array(z.enum(CLAVES)).min(1).max(2),
});

export type SalidaBorrador = z.infer<typeof salidaBorradorSchema>;

export interface Borrador extends SalidaBorrador {
  placeId: string;
  negocio: string;
  estado: typeof MARCA_REVISION | typeof MARCA_REVISION_EN;
  enviado: false;
  modelo: string;
}

/** Promesas que un primer contacto no puede hacer (resultados, porcentajes, garantías). */
const PROMESAS = /(garantiz|aseguramos|te aseguro|duplic|triplic|\d+\s?%|primer(?:o|a)s? (?:lugar|puesto|resultado)|más ventas seguras|100\s?% |guarante|we promise|doubl|tripl|first page|top of google|more sales)/i;

/** Números que el borrador puede usar: los que aparecen en las señales medidas del negocio. */
export function numerosPermitidos(lead: Lead): Set<string> {
  const textos = (lead.senales ?? []).map((s) => s.detalle);
  return new Set(textos.flatMap((t) => t.match(/\d+(?:[.,]\d+)?/g) ?? []).map((n) => n.replace(".", ",")));
}

export type ProblemaBorrador = { tipo: "esquema" | "numero_inventado" | "promesa" | "metrica_ajena"; detalle: string };

export function revisarBorrador(lead: Lead, salida: unknown): { ok: true; valor: SalidaBorrador } | { ok: false; problemas: ProblemaBorrador[] } {
  const p = salidaBorradorSchema.safeParse(salida);
  if (!p.success) return { ok: false, problemas: [{ tipo: "esquema", detalle: p.error.issues[0]?.message ?? "forma inválida" }] };
  const problemas: ProblemaBorrador[] = [];
  const texto = [p.data.asunto, ...p.data.lineas, p.data.cta].join(" ");
  const permitidos = numerosPermitidos(lead);
  for (const n of texto.match(/\d+(?:[.,]\d+)?/g) ?? []) {
    if (!permitidos.has(n.replace(".", ","))) problemas.push({ tipo: "numero_inventado", detalle: n });
  }
  const promesa = texto.match(PROMESAS);
  if (promesa) problemas.push({ tipo: "promesa", detalle: promesa[0] });
  const propias = new Set<ClaveSenal>((lead.senales ?? []).map((s) => s.clave));
  for (const m of p.data.metricas_citadas) if (!propias.has(m)) problemas.push({ tipo: "metrica_ajena", detalle: m });
  return problemas.length ? { ok: false, problemas } : { ok: true, valor: p.data };
}

export const SISTEMA_BORRADOR = `Escribís primeros contactos para "Pixel Patagonia", una agencia web de Neuquén (ficticia). El destinatario es el negocio (nunca una persona por nombre).

Reglas:
1. Usá SOLO los datos medidos que vienen en "Señales". No inventes números, plazos, precios ni resultados; no prometas ventas, posiciones ni porcentajes.
2. Citá 1 o 2 señales con su número tal cual aparece (por ejemplo "38/100" o "6,2 s") y poné sus claves en "metricas_citadas".
3. Tono cercano y respetuoso, español rioplatense, sin exagerar. Nada de "revolucionar" ni "transformar tu negocio".
4. Asunto de hasta 80 caracteres. Tres líneas cortas: qué viste, por qué le importa a sus clientes, qué harías. Un llamado suave sin números (por ejemplo, ofrecer mostrar la medición en una charla corta).
5. Los únicos números permitidos son los que aparecen en las señales.`;

export const SISTEMA_BORRADOR_EN = `You write first-contact messages for "Pixel Patagonia", a (fictional) web agency in Neuquén, Argentina. The recipient is the business (never a person by name). Write in English.

Rules:
1. Use ONLY the measured data in "Señales" (signals). Do not invent numbers, timeframes, prices or results; do not promise sales, rankings or percentages.
2. Cite 1 or 2 signals with their number exactly as it appears (for example "38/100" or "6.2 s") and put their keys in "metricas_citadas".
3. Friendly, respectful tone, no hype. No "revolutionize" or "transform your business".
4. Subject up to 80 characters. Three short lines: what you saw, why it matters to their customers, what you would do. A soft call to action with no numbers (for example, offering to walk them through the measurement in a short call).
5. The only numbers allowed are the ones in the signals.`;

export function armarPedido(lead: Lead): string {
  const senales = (lead.senales ?? []).map((s) => `- ${s.clave}: ${s.detalle}`).join("\n") || "- (sin señales)";
  return `Negocio: ${lead.nombre ?? lead.placeId}\nRubro: ${lead.rubro ?? "sin dato"}\nWeb: ${lead.web ?? "no tiene"}\nSeñales:\n${senales}`;
}

export async function generarBorrador(lead: Lead, modelo: ModeloJson, intentos = 2, idioma: IdiomaBorrador = "es"): Promise<{ borrador: Borrador; uso: Uso } | { error: string; problemas: ProblemaBorrador[] }> {
  if (!lead.senales?.length) return { error: "El negocio no tiene señales de mejora: no hay nada concreto para proponer.", problemas: [] };
  let problemas: ProblemaBorrador[] = [];
  const uso: Uso = { entrada: 0, salida: 0 };
  for (let i = 0; i < intentos; i++) {
    const r = await modelo.generar({ sistema: idioma === "en" ? SISTEMA_BORRADOR_EN : SISTEMA_BORRADOR, usuario: armarPedido(lead), schema: z.toJSONSchema(salidaBorradorSchema) as Record<string, unknown> });
    uso.entrada += r.uso.entrada;
    uso.salida += r.uso.salida;
    const revision = revisarBorrador(lead, r.json);
    if (revision.ok) {
      return { borrador: { ...revision.valor, placeId: lead.placeId, negocio: lead.nombre ?? lead.placeId, estado: idioma === "en" ? MARCA_REVISION_EN : MARCA_REVISION, enviado: false, modelo: modelo.nombre }, uso };
    }
    problemas = revision.problemas;
  }
  return { error: "El borrador no pasó la revisión automática (usaba datos que no están medidos o prometía resultados).", problemas };
}
