import type { Metadata } from "next";
import { Documento, metadataDe, viewportRadar } from "@/components/Documento";

export const metadata: Metadata = metadataDe("en");
export const viewport = viewportRadar;

export default function LayoutIngles({ children }: Readonly<{ children: React.ReactNode }>) {
  return <Documento idioma="en">{children}</Documento>;
}
