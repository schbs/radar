// Guardia común de las rutas de la API: solo JSON y solo desde la misma página (ningún otro sitio puede dispararlas
// desde el navegador de quien tenga la consola abierta). Lo que protege el modo real es que solo existe con
// `npm run dev:real`, que escucha en 127.0.0.1 (ver modoRadar); el Host local es una segunda barrera, no la principal.
import "server-only";
import { modoRadar } from "./corrida";

const LOCALES = new Set(["localhost", "127.0.0.1", "[::1]"]);

export function rechazo(pedido: Request): Response | null {
  if (!pedido.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
    return Response.json({ error: "Se espera JSON." }, { status: 415 });
  }
  const sitio = pedido.headers.get("sec-fetch-site");
  if (sitio && sitio !== "same-origin" && sitio !== "none") return Response.json({ error: "Origen no permitido." }, { status: 403 });
  const origen = pedido.headers.get("origin");
  const host = pedido.headers.get("host");
  if (origen && (!host || URL.parse(origen)?.host !== host)) return Response.json({ error: "Origen no permitido." }, { status: 403 });
  if (modoRadar() === "real") {
    const nombre = host?.replace(/:\d+$/, "") ?? "";
    // (Next agrega X-Forwarded-For a todo pedido, así que no sirve para distinguir; alcanza con el Host y escuchar en 127.0.0.1.)
    if (!LOCALES.has(nombre)) return Response.json({ error: "El modo real solo se usa desde esta PC." }, { status: 403 });
  }
  return null;
}
