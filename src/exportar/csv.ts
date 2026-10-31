// Export a CSV (UTF-8 con BOM para que Excel respete los acentos). Solo datos de empresa y lo medido; nunca personas.
// Las celdas que empiezan con = + - @ se anteponen con ' para que una planilla no las ejecute como fórmula.
import type { Lead } from "@/pipeline/tipos";

export const COLUMNAS = ["place_id", "negocio", "rubro", "direccion", "web", "score", "motivo_principal", "senales", "rendimiento_movil", "lcp_s", "resenas"] as const;

export function celda(valor: unknown): string {
  let t = valor == null ? "" : String(valor);
  if (/^[=+\-@\t\r]/.test(t)) t = `'${t}`;
  return /[",\n\r;]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
}

export function leadsACsv(leads: Lead[]): string {
  const filas = leads.map((l) => [
    l.placeId,
    l.nombre,
    l.rubro,
    l.direccion,
    l.web ?? "",
    l.score?.total ?? "",
    l.score?.motivoPrincipal ?? "",
    (l.senales ?? []).map((s) => s.clave).join(" | "),
    l.pagespeed?.rendimiento ?? "",
    l.pagespeed?.lcpSegundos ?? "",
    l.resenas ?? "",
  ]);
  return "﻿" + [COLUMNAS as readonly string[], ...filas].map((f) => f.map(celda).join(",")).join("\r\n") + "\r\n";
}
