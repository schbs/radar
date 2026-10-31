// <html> de cada idioma: un layout raíz por grupo de rutas ((es) y (en)) para que lang sea el correcto.
import type { Metadata, Viewport } from "next";
import { IBM_Plex_Sans, Martian_Mono } from "next/font/google";
import { TEXTOS, type Idioma } from "@/i18n/textos";
import "@/app/globals.css";

const martian = Martian_Mono({ subsets: ["latin"], variable: "--font-martian", display: "swap" });
const plex = IBM_Plex_Sans({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-plex", display: "swap" });

export function metadataDe(idioma: Idioma): Metadata {
  const t = TEXTOS[idioma].meta;
  // Sin hreflang hasta tener la URL pública: Lighthouse pide direcciones absolutas.
  return { title: t.titulo, description: t.descripcion };
}

export const viewportRadar: Viewport = { themeColor: "#14171f" };

export function Documento({ idioma, children }: { idioma: Idioma; children: React.ReactNode }) {
  return (
    <html lang={TEXTOS[idioma].lang} className={`${martian.variable} ${plex.variable}`}>
      <body>{children}</body>
    </html>
  );
}
