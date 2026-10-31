// Export mínimo a HubSpot: upsert de la empresa (por dominio si tiene web; si no, por nombre). La misma idea que el
// adaptador de Embudo, reducida a lo que necesita Radar. Solo datos de empresa; nada de contactos ni personas.
import { redSocialDe } from "@/etapas/senales";
import type { Fetch, Lead } from "@/pipeline/tipos";

const BASE = "https://api.hubapi.com";

export class ErrorHubspot extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

/** Dominio propio del negocio. Una página de Facebook o Instagram no cuenta: todas compartirían el mismo dominio. */
export const dominioDe = (web: string | null | undefined) => (web && !redSocialDe(web) ? new URL(web).hostname.replace(/^www\./, "") : null);

export function crearExportHubspot(token: string, fetchHttp: Fetch = fetch) {
  const pedir = async <T>(metodo: string, ruta: string, cuerpo?: unknown): Promise<T> => {
    const r = await fetchHttp(`${BASE}${ruta}`, {
      method: metodo,
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: cuerpo ? JSON.stringify(cuerpo) : undefined,
      signal: AbortSignal.timeout(15_000),
    });
    const datos = (await r.json().catch(() => ({}))) as T & { message?: string };
    // El mensaje de HubSpot no incluye el token.
    if (!r.ok) throw new ErrorHubspot(`HubSpot ${r.status}: ${datos.message ?? "error"}`, r.status);
    return datos;
  };

  return {
    async upsertEmpresa(lead: Lead): Promise<{ id: string; creado: boolean }> {
      const dominio = dominioDe(lead.web);
      const filtro = dominio ? { propertyName: "domain", operator: "EQ", value: dominio } : { propertyName: "name", operator: "EQ", value: lead.nombre ?? lead.placeId };
      const existente = await pedir<{ results: { id: string }[] }>("POST", "/crm/v3/objects/companies/search", { filterGroups: [{ filters: [filtro] }], properties: ["name"], limit: 1 });
      const propiedades = {
        name: lead.nombre ?? lead.placeId,
        ...(dominio ? { domain: dominio } : {}),
        description: `Radar: score ${lead.score?.total ?? "-"} · ${lead.score?.motivoPrincipal ?? ""}`.slice(0, 500),
      };
      if (existente.results[0]) {
        await pedir("PATCH", `/crm/v3/objects/companies/${existente.results[0].id}`, { properties: propiedades });
        return { id: existente.results[0].id, creado: false };
      }
      const nueva = await pedir<{ id: string }>("POST", "/crm/v3/objects/companies", { properties: propiedades });
      return { id: nueva.id, creado: true };
    },
  };
}
