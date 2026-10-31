// Tipos del pipeline de prospección. Un lead es un negocio (dato público de empresa, nunca de personas) que pasa por
// etapas en cascada; cada etapa implementa Enricher y deja su rastro (tiempo, costo, caché, salto o error).
import type { Cache } from "@/cache/tipos";

export interface DatosSitio {
  alcanzable: boolean;
  /** La URL final (después de redirecciones) es https. */
  https: boolean;
  /** Pedir la versión http redirige a https. null si no se pudo comprobar. */
  redirigeAHttps: boolean | null;
  status: number | null;
  /** Hay un enlace o botón a WhatsApp (wa.me, api.whatsapp.com o whatsapp://) en la portada. */
  whatsapp: boolean;
  error?: string;
}

export interface DatosPageSpeed {
  /** 0–100, Lighthouse móvil. */
  rendimiento: number | null;
  lcpSegundos: number | null;
  cls: number | null;
  tbtMs: number | null;
}

export type ClaveSenal = "sin_web" | "solo_redes" | "web_no_responde" | "sin_https" | "sin_redireccion_https" | "web_lenta" | "lcp_lento" | "sin_whatsapp" | "pocas_resenas";

export interface Senal {
  clave: ClaveSenal;
  /** Texto corto para la tabla y el borrador: siempre con el dato medido que la sostiene. */
  detalle: string;
}

export interface ComponenteScore {
  clave: ClaveSenal | "negocio_activo";
  puntos: number;
  detalle: string;
}

/** Score explicable: el total sale de la suma de los componentes (tope 100) y el motivo principal es el de más peso. */
export interface Score {
  total: number;
  componentes: ComponenteScore[];
  motivoPrincipal: string;
}

export interface PasoTraza {
  etapa: string;
  ms: number;
  /** USD estimados de esta etapa para este lead (0 si vino de caché o se salteó). */
  costo: number;
  desdeCache: boolean;
  saltada: boolean;
  /** Por qué se salteó (por ejemplo, "sin web"). */
  motivo?: string;
  intentos: number;
  error?: string;
}

export interface Lead {
  /** Único dato que se guarda sin vencimiento (términos de Google Maps Platform). */
  placeId: string;
  nombre?: string;
  rubro?: string;
  direccion?: string;
  web?: string | null;
  rating?: number | null;
  resenas?: number | null;
  sitio?: DatosSitio;
  pagespeed?: DatosPageSpeed | null;
  senales?: Senal[];
  score?: Score;
  traza: PasoTraza[];
}

export type Fetch = (url: string, init?: RequestInit) => Promise<Response>;

export interface Contexto {
  fetch: Fetch;
  cache: Cache;
  ahora: () => number;
  /** Claves de API (solo en el servidor; nunca se loguean). */
  claves: { google?: string };
}

export interface Enricher {
  name: string;
  /** USD estimados por lead cuando la etapa corre de verdad (sin caché). */
  cost: number;
  /** Cuánto vale su resultado en caché (ms, como máximo 30 días). Sin ttlMs, la etapa no se cachea. */
  ttlMs?: number;
  /** Si devuelve un texto, la etapa se saltea con ese motivo (por ejemplo, sin web no hay PageSpeed). */
  saltear?: (lead: Lead) => string | null;
  run(lead: Lead, ctx: Contexto): Promise<Partial<Lead>>;
}

/** Error de una API externa: decide si conviene reintentar. */
export class ErrorHttp extends Error {
  constructor(
    message: string,
    readonly status: number | null,
  ) {
    super(message);
    this.name = "ErrorHttp";
  }
  get reintentable() {
    return this.status === null || this.status === 429 || this.status >= 500;
  }
}
