// Borrador de abordaje para un lead. Con Gemini solo en modo real (en la PC); en la demo, la plantilla sin IA, que pasa
// por la misma revisión. El borrador vuelve al navegador marcado "para revisión humana": no existe ninguna ruta de envío.
// ?idioma=en: la consola en inglés manda las señales en inglés (mismos números) y el borrador sale en inglés.
import { generarBorrador } from "@/borrador/borrador";
import { crearModeloPlantilla } from "@/borrador/plantilla";
import { CupoAgotado, crearModeloGemini } from "@/ia/gemini";
import { modoRadar } from "@/lib/corrida";
import { leadEntradaSchema } from "@/lib/esquemas";
import { rechazo } from "@/lib/guardia";

export async function POST(pedido: Request) {
  const rechazado = rechazo(pedido);
  if (rechazado) return rechazado;
  const idioma = new URL(pedido.url).searchParams.get("idioma") === "en" ? "en" : "es";
  const datos = leadEntradaSchema.safeParse(await pedido.json().catch(() => null));
  if (!datos.success) return Response.json({ error: "Negocio inválido." }, { status: 400 });
  const lead = { ...datos.data, traza: [] };
  const plantilla = crearModeloPlantilla(idioma);
  const conIa = modoRadar() === "real" && Boolean(process.env.GEMINI_API_KEY);
  const modelo = conIa ? crearModeloGemini({ apiKey: process.env.GEMINI_API_KEY!, modelo: process.env.GEMINI_MODEL || undefined }) : plantilla;
  try {
    const r = await generarBorrador(lead, modelo, 2, idioma);
    return "borrador" in r ? Response.json(r) : Response.json(r, { status: 422 });
  } catch (e) {
    if (e instanceof CupoAgotado) {
      const r = await generarBorrador(lead, plantilla, 2, idioma);
      return Response.json({ ...r, aviso: idioma === "en" ? "Gemini's daily quota ran out: this draft comes from the template (no AI)." : "Se terminó el cupo de Gemini por hoy: el borrador sale de la plantilla sin IA." });
    }
    console.error("borrador falló:", e instanceof Error ? e.message : e);
    return Response.json({ error: "No se pudo generar el borrador. Probá de nuevo." }, { status: 502 });
  }
}
