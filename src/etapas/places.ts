// Places API (New). La búsqueda por texto pide solo IDs (el SKU más barato) y la etapa places_search trae, por cada
// place_id, los datos de empresa que usa el puntaje. Nada de personas: ni reseñas con autor ni teléfonos.
import { DIA_MS, PRECIO } from "@/pipeline/precios";
import { ErrorHttp, type Contexto, type Enricher, type Lead } from "@/pipeline/tipos";

const BASE = "https://places.googleapis.com/v1";
const CAMPOS_DETALLE = "displayName,formattedAddress,websiteUri,rating,userRatingCount,primaryTypeDisplayName";

async function pedirJson(ctx: Contexto, url: string, init: RequestInit): Promise<Record<string, unknown>> {
  let r: Response;
  try {
    r = await ctx.fetch(url, { ...init, signal: AbortSignal.timeout(15_000) });
  } catch (e) {
    throw new ErrorHttp(`Places sin respuesta: ${e instanceof Error ? e.name : "error"}`, null);
  }
  const cuerpo = (await r.json().catch(() => ({}))) as { error?: { message?: string } } & Record<string, unknown>;
  // El mensaje de error de Google no incluye la clave.
  if (!r.ok) throw new ErrorHttp(`Places ${r.status}: ${cuerpo.error?.message ?? "error"}`, r.status);
  return cuerpo;
}

/** Busca negocios de un rubro en una ciudad y devuelve leads con solo el place_id (lo único que se guarda sin vencer). */
export async function buscarNegocios(consulta: { rubro: string; ciudad: string; maximo?: number }, ctx: Contexto): Promise<{ leads: Lead[]; costo: number; desdeCache: boolean }> {
  const texto = `${consulta.rubro} en ${consulta.ciudad}`;
  const clave = `busqueda:${texto.toLowerCase()}`;
  const guardado = await ctx.cache.leer<string[]>(clave, ctx.ahora());
  const maximo = Math.min(consulta.maximo ?? 20, 20);
  if (guardado) return { leads: guardado.slice(0, maximo).map((placeId) => ({ placeId, traza: [] })), costo: 0, desdeCache: true };

  const datos = await pedirJson(ctx, `${BASE}/places:searchText`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Goog-Api-Key": ctx.claves.google ?? "", "X-Goog-FieldMask": "places.id" },
    body: JSON.stringify({ textQuery: texto, languageCode: "es", pageSize: maximo }),
  });
  const ids = ((datos.places as { id: string }[] | undefined) ?? []).map((p) => p.id).slice(0, maximo);
  await ctx.cache.guardar(clave, ids, 30 * DIA_MS, ctx.ahora());
  return { leads: ids.map((placeId) => ({ placeId, traza: [] })), costo: PRECIO.textSearchIds, desdeCache: false };
}

interface DetalleLugar {
  displayName?: { text?: string };
  formattedAddress?: string;
  websiteUri?: string;
  rating?: number;
  userRatingCount?: number;
  primaryTypeDisplayName?: { text?: string };
}

export const placesSearch: Enricher = {
  name: "places_search",
  cost: PRECIO.detalleLugar,
  ttlMs: 30 * DIA_MS,
  async run(lead, ctx) {
    const d = (await pedirJson(ctx, `${BASE}/places/${encodeURIComponent(lead.placeId)}?languageCode=es`, {
      headers: { "X-Goog-Api-Key": ctx.claves.google ?? "", "X-Goog-FieldMask": CAMPOS_DETALLE },
    })) as DetalleLugar;
    return {
      nombre: d.displayName?.text ?? lead.placeId,
      rubro: d.primaryTypeDisplayName?.text,
      direccion: d.formattedAddress,
      web: d.websiteUri ?? null,
      rating: d.rating ?? null,
      resenas: d.userRatingCount ?? null,
    };
  },
};
