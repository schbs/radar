// Caché en memoria (tests y corrida en seco) y en archivo JSON local (corridas reales, data/cache/, fuera de git).
import fs from "node:fs";
import path from "node:path";
import { validarTtl, type Cache, type Entrada } from "./tipos";

export function crearCacheMemoria(inicial: Record<string, Entrada> = {}): Cache & { entradas: Record<string, Entrada> } {
  const entradas: Record<string, Entrada> = { ...inicial };
  return {
    nombre: "memoria",
    entradas,
    async leer<T>(clave: string, ahora: number) {
      const e = entradas[clave];
      if (!e) return null;
      if (e.venceEn <= ahora) {
        delete entradas[clave];
        return null;
      }
      return e.valor as T;
    },
    async guardar(clave, valor, ttlMs, ahora) {
      validarTtl(ttlMs);
      entradas[clave] = { valor, guardadoEn: ahora, venceEn: ahora + ttlMs };
    },
    async purgar(ahora) {
      let n = 0;
      for (const [k, e] of Object.entries(entradas)) {
        if (e.venceEn > ahora) continue;
        delete entradas[k];
        n++;
      }
      return n;
    },
  };
}

// Solo se usa en modo real, en la PC: se le dice a Turbopack que no rastree estas rutas (si no, empaqueta todo el proyecto).
export function crearCacheArchivo(archivo = path.join("data", "cache", "radar.json")): Cache {
  const cargar = (): Record<string, Entrada> => (fs.existsSync(/*turbopackIgnore: true*/ archivo) ? (JSON.parse(fs.readFileSync(/*turbopackIgnore: true*/ archivo, "utf8")) as Record<string, Entrada>) : {});
  const memoria = crearCacheMemoria(cargar());
  const escribir = () => {
    fs.mkdirSync(/*turbopackIgnore: true*/ path.dirname(archivo), { recursive: true });
    fs.writeFileSync(/*turbopackIgnore: true*/ archivo, JSON.stringify(memoria.entradas));
  };
  return {
    nombre: "archivo",
    leer: (clave, ahora) => memoria.leer(clave, ahora),
    async guardar(clave, valor, ttlMs, ahora) {
      await memoria.guardar(clave, valor, ttlMs, ahora);
      escribir();
    },
    async purgar(ahora) {
      const n = await memoria.purgar(ahora);
      if (n) escribir();
      return n;
    },
  };
}
