// Lo que aceptan las rutas de la API. Un lead llega del navegador, así que se valida entero y con topes de tamaño.
import { z } from "zod";
import { CLAVES } from "@/borrador/borrador";

export const consultaSchema = z.object({
  rubro: z.string().trim().min(2, "Escribí un rubro (por ejemplo, veterinarias).").max(40),
  ciudad: z.string().trim().min(2, "Escribí una ciudad.").max(40),
  maximo: z.coerce.number().int().min(1).max(20).default(12),
});

export const leadEntradaSchema = z.object({
  placeId: z.string().min(1).max(200),
  nombre: z.string().max(200).optional(),
  rubro: z.string().max(100).optional(),
  direccion: z.string().max(300).optional(),
  web: z.string().max(500).nullable().optional(),
  resenas: z.number().nullable().optional(),
  senales: z.array(z.object({ clave: z.enum(CLAVES), detalle: z.string().max(300) })).max(12).optional(),
  score: z.object({ total: z.number(), motivoPrincipal: z.string().max(300), componentes: z.array(z.object({ clave: z.enum([...CLAVES, "negocio_activo"]), puntos: z.number(), detalle: z.string().max(300) })).max(12) }).optional(),
});

export const leadsEntradaSchema = z.array(leadEntradaSchema).min(1).max(20);
