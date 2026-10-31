// Export a HubSpot (upsert de company). Sin HUBSPOT_TOKEN, o en la demo, es una simulación: devuelve lo que se
// mandaría sin llamar a HubSpot. Con token (solo en la PC, modo real) hace el upsert de verdad, de a uno.
import { crearExportHubspot, dominioDe } from "@/exportar/hubspot";
import { modoRadar } from "@/lib/corrida";
import { leadsEntradaSchema } from "@/lib/esquemas";
import { rechazo } from "@/lib/guardia";

export async function POST(pedido: Request) {
  const rechazado = rechazo(pedido);
  if (rechazado) return rechazado;
  const datos = leadsEntradaSchema.safeParse(await pedido.json().catch(() => null));
  if (!datos.success) return Response.json({ error: "Lista de negocios inválida (de 1 a 20)." }, { status: 400 });
  const leads = datos.data.map((l) => ({ ...l, traza: [] }));
  const token = process.env.HUBSPOT_TOKEN;
  if (modoRadar() !== "real" || !token) {
    return Response.json({
      simulado: true,
      empresas: leads.map((l) => ({ name: l.nombre ?? l.placeId, domain: dominioDe(l.web), busca_por: dominioDe(l.web) ? "domain" : "name" })),
    });
  }
  const hubspot = crearExportHubspot(token);
  const resultados = [];
  for (const l of leads) {
    try {
      resultados.push({ negocio: l.nombre, ...(await hubspot.upsertEmpresa(l)) });
    } catch (e) {
      resultados.push({ negocio: l.nombre, error: e instanceof Error ? e.message : "error" });
    }
  }
  return Response.json({ simulado: false, resultados });
}
