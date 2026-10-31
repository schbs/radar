// "Modelo" sin IA para el modo demo y los tests: arma el borrador con plantillas a partir de las señales del pedido.
// Pasa la misma revisión que el de Gemini (usa los números tal cual vienen en las señales). En español o en inglés.
import type { ModeloJson } from "@/ia/gemini";
import type { IdiomaBorrador } from "./borrador";

const QUE_VIMOS: Record<IdiomaBorrador, Record<string, string>> = {
  es: {
    sin_web: "Vimos que en su ficha de Google no figura una web",
    solo_redes: "Vimos que en Google los encuentran por sus redes",
    web_no_responde: "Quisimos entrar a su web y no respondió",
    sin_https: "Su web todavía no usa HTTPS, y el navegador la marca como no segura",
    sin_redireccion_https: "Si alguien escribe la dirección con http://, la web no lo pasa a la versión segura",
    web_lenta: "Medimos su web en el celular con PageSpeed",
    lcp_lento: "En el celular, la parte principal de su web tarda en aparecer",
    sin_whatsapp: "En la portada no encontramos un botón para escribirles por WhatsApp",
    pocas_resenas: "Tienen pocas reseñas en Google",
  },
  en: {
    sin_web: "We noticed your Google listing doesn't show a website",
    solo_redes: "We noticed people find you on Google through your social media",
    web_no_responde: "We tried to visit your website and it didn't respond",
    sin_https: "Your website doesn't use HTTPS yet, so browsers flag it as not secure",
    sin_redireccion_https: "If someone types your address with http://, the site doesn't send them to the secure version",
    web_lenta: "We measured your website on mobile with PageSpeed",
    lcp_lento: "On mobile, the main part of your website takes a while to appear",
    sin_whatsapp: "We couldn't find a WhatsApp button on your home page",
    pocas_resenas: "You have few reviews on Google",
  },
};

const FRASES = {
  es: {
    otroQueVimos: "Revisamos su presencia online",
    tambien: "También",
    porQue: "Es lo primero que ven quienes los buscan desde el celular.",
    asunto: (n: string) => `${n}: una mejora concreta para su web`,
    propuesta: "Podemos mostrarles qué cambiaríamos primero y por qué, con la medición en mano.",
    cta: "Si les sirve, les mostramos la medición en una charla corta.",
  },
  en: {
    otroQueVimos: "We reviewed your online presence",
    tambien: "Also",
    porQue: "It's the first thing people see when they look you up on their phone.",
    asunto: (n: string) => `${n}: one concrete improvement for your website`,
    propuesta: "We can show you what we would change first and why, with the measurement in hand.",
    cta: "If it helps, we can walk you through the measurement in a short call.",
  },
};

const minuscula = (t: string) => `${t.charAt(0).toLowerCase()}${t.slice(1)}`;

export function crearModeloPlantilla(idioma: IdiomaBorrador = "es"): ModeloJson {
  const f = FRASES[idioma];
  return {
    nombre: idioma === "en" ? "template (no AI)" : "plantilla (sin IA)",
    async generar({ usuario }) {
      const negocio = usuario.match(/^Negocio: (.+)$/m)?.[1] ?? "su negocio";
      const senales = [...usuario.matchAll(/^- ([a-z_]+): (.+)$/gm)].map((m) => ({ clave: m[1], detalle: m[2] }));
      const [a, b] = senales;
      const vimos = QUE_VIMOS[idioma][a.clave] ?? f.otroQueVimos;
      // El detalle se suma solo si trae el dato medido; si no, repetiría lo mismo con otras palabras.
      const lineaA = /\d/.test(a.detalle) ? `${vimos}: ${minuscula(a.detalle)}.` : `${vimos}.`;
      const lineaB = b ? `${f.tambien}: ${minuscula(b.detalle)}.` : f.porQue;
      return {
        json: {
          asunto: f.asunto(negocio).slice(0, 80),
          lineas: [lineaA.slice(0, 240), lineaB.slice(0, 240), f.propuesta],
          cta: f.cta,
          metricas_citadas: senales.slice(0, 2).map((s) => s.clave),
        },
        uso: { entrada: 0, salida: 0 },
      };
    },
  };
}

export const modeloPlantilla = crearModeloPlantilla("es");
