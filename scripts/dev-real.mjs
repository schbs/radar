// Consola en modo real (Places, webs y PageSpeed de verdad; Gemini para los borradores), solo en esta PC:
// escucha en 127.0.0.1, así nadie de la red local puede usar las claves. Uso: npm run dev:real
// Es lo único que enciende el modo real: src/lib/corrida.ts pide RADAR_REAL=1 y RADAR_ESCUCHA=127.0.0.1, y las dos
// salen de acá con el mismo valor que se le pasa a -H.
import { spawn } from "node:child_process";
import path from "node:path";

const ESCUCHA = "127.0.0.1";
const next = path.join("node_modules", "next", "dist", "bin", "next");
const hijo = spawn(process.execPath, [next, "dev", "-H", ESCUCHA, "-p", "3204"], { stdio: "inherit", env: { ...process.env, RADAR_REAL: "1", RADAR_ESCUCHA: ESCUCHA } });
hijo.on("exit", (codigo) => process.exit(codigo ?? 0));
