// Consola de Radar en un idioma. En la demo, la página llega ya con la corrida de ejemplo (negocios ficticios, sin
// red); en modo real arranca vacía y la primera corrida la pide el equipo.
import { Consola } from "@/components/Consola";
import type { Idioma } from "@/i18n/textos";
import { CONSULTA_DEMO, correr, modoRadar } from "@/lib/corrida";

export async function PaginaRadar({ idioma }: { idioma: Idioma }) {
  const modo = modoRadar();
  const consulta = { rubro: idioma === "en" ? "vets" : CONSULTA_DEMO.rubro, ciudad: CONSULTA_DEMO.ciudad, maximo: 12 };
  const inicial = modo === "demo" ? await correr(consulta) : null;
  return <Consola idioma={idioma} modo={modo} inicial={inicial} consultaInicial={consulta} />;
}
