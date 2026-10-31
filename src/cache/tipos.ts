// Caché por place_id con vencimiento. Según los términos de Google Maps Platform, solo el place_id se puede guardar
// sin límite; el resto del contenido de Places va con TTL. Acá el TTL nunca supera 30 días.
export const TTL_MAXIMO_MS = 30 * 24 * 60 * 60 * 1000;

export interface Entrada<T = unknown> {
  valor: T;
  guardadoEn: number;
  venceEn: number;
}

export interface Cache {
  nombre: string;
  leer<T>(clave: string, ahora: number): Promise<T | null>;
  guardar<T>(clave: string, valor: T, ttlMs: number, ahora: number): Promise<void>;
  /** Borra lo vencido; devuelve cuántas entradas se fueron. */
  purgar(ahora: number): Promise<number>;
}

export class TtlInvalido extends Error {}

export function validarTtl(ttlMs: number): void {
  if (!Number.isFinite(ttlMs) || ttlMs <= 0 || ttlMs > TTL_MAXIMO_MS) throw new TtlInvalido(`TTL fuera de rango (0 a 30 días): ${ttlMs} ms`);
}
