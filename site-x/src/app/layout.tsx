import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = { title: "Fieldnote | Pesquisa de campo com evidência", description: "Planeje pesquisas, conecte evidências e transforme sessões de campo em decisões confiáveis.", metadataBase: new URL("https://fieldnote.app") };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="pt-BR"><body>{children}</body></html>; }
