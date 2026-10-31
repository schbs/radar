import { correr, modoRadar } from "@/lib/corrida";
import { consultaSchema } from "@/lib/esquemas";
import { rechazo } from "@/lib/guardia";

// En modo real, una corrida a la vez: cada una pide hasta 20 detalles a Places.
let corriendo = false;

export async function POST(pedido: Request) {
  const r = rechazo(pedido);
  if (r) return r;
  const datos = consultaSchema.safeParse(await pedido.json().catch(() => null));
  if (!datos.success) return Response.json({ error: datos.error.issues[0]?.message ?? "Consulta inválida." }, { status: 400 });
  const real = modoRadar() === "real";
  if (real && corriendo) return Response.json({ error: "Ya hay una corrida en curso. Esperá a que termine." }, { status: 429 });
  corriendo = real;
  try {
    return Response.json(await correr(datos.data));
  } catch (e) {
    // El detalle va al log del servidor (sin claves: los mensajes de las etapas no las incluyen).
    console.error("corrida falló:", e instanceof Error ? e.message : e);
    return Response.json({ error: "La corrida falló. Probá de nuevo en un rato." }, { status: 502 });
  } finally {
    if (real) corriendo = false;
  }
}
